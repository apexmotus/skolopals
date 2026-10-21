-- Transactional operations for enrolment and timetabling.
--
-- These are RPCs rather than a sequence of client inserts because each one
-- must be all-or-nothing. A learner created without consents, or an enrolment
-- activated without its registration invoice, is worse than a failed attempt -
-- the first is a POPIA problem, the second a billing one.

-- Submit an enrolment -------------------------------------------------------
-- Runs as the signed-in guardian. Creates the learner, the guardian link, the
-- safeguarding records, the consents and a PENDING enrolment in one go.
create or replace function public.submit_enrolment(
  p_learner        jsonb,
  p_package_code   text,
  p_subjects       jsonb,
  p_emergency      jsonb,
  p_collectors     jsonb,
  p_consents       jsonb,
  p_policy_version text,
  p_preferred_tutor uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_guardian uuid := (select auth.uid());
  v_learner  uuid;
  v_enrolment uuid;
  v_item jsonb;
  v_required integer;
  v_granted integer;
begin
  if v_guardian is null then
    raise exception 'Not signed in' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.guardians where profile_id = v_guardian) then
    raise exception 'Only a parent or guardian can enrol a learner' using errcode = 'P0001';
  end if;

  -- Every required consent must be present and granted. POPIA s35 is checked
  -- here as well as by the activation trigger, so an incomplete submission
  -- never creates a learner record at all.
  select count(*) into v_required from public.consent_types where is_required;
  select count(*) into v_granted
  from jsonb_array_elements(p_consents) c
  join public.consent_types ct on ct.code = c ->> 'consent_type_code'
  where ct.is_required and (c ->> 'granted')::boolean;

  if v_granted < v_required then
    raise exception 'All required consents must be given before a learner can be registered'
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(p_emergency) < 1 then
    raise exception 'At least one emergency contact is required'
      using errcode = 'check_violation';
  end if;

  insert into public.learners (full_name, date_of_birth, grade_code, school_name, home_language_code, status)
  values (
    p_learner ->> 'full_name',
    (p_learner ->> 'date_of_birth')::date,
    p_learner ->> 'grade_code',
    coalesce(p_learner ->> 'school_name', ''),
    nullif(p_learner ->> 'home_language_code', '')
  , 'prospective')
  returning id into v_learner;

  insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact)
  values (v_learner, v_guardian, coalesce(p_learner ->> 'relationship', 'guardian'), true, true);

  for v_item in select * from jsonb_array_elements(p_emergency) loop
    insert into public.learner_emergency_contacts (learner_id, full_name, relationship, phone, priority)
    values (v_learner, v_item ->> 'full_name', v_item ->> 'relationship', v_item ->> 'phone',
            coalesce((v_item ->> 'priority')::smallint, 1));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_collectors, '[]'::jsonb)) loop
    insert into public.authorised_collectors (learner_id, full_name, relationship, phone, id_number_last4)
    values (v_learner, v_item ->> 'full_name', v_item ->> 'relationship', v_item ->> 'phone',
            nullif(v_item ->> 'id_number_last4', ''));
  end loop;

  for v_item in select * from jsonb_array_elements(p_consents) loop
    insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
    values (v_item ->> 'consent_type_code', v_guardian, v_learner,
            (v_item ->> 'granted')::boolean, p_policy_version);
  end loop;

  insert into public.enrolments (learner_id, package_code, status, preferred_tutor_id, source)
  values (v_learner, p_package_code, 'pending', p_preferred_tutor, 'website')
  returning id into v_enrolment;

  for v_item in select * from jsonb_array_elements(coalesce(p_subjects, '[]'::jsonb)) loop
    insert into public.enrolment_subjects (enrolment_id, subject_code, preferred_language_code)
    values (v_enrolment, v_item ->> 'subject_code', nullif(v_item ->> 'preferred_language_code', ''));
  end loop;

  return v_enrolment;
end;
$fn$;

revoke execute on function public.submit_enrolment(jsonb, text, jsonb, jsonb, jsonb, jsonb, text, uuid) from public, anon;
grant execute on function public.submit_enrolment(jsonb, text, jsonb, jsonb, jsonb, jsonb, text, uuid) to authenticated;

-- Activate an enrolment -----------------------------------------------------
-- Admin approval. Sets the enrolment live, opens a billing account if the
-- family does not have one, and raises the once-off registration invoice
-- immediately (SPEC rule 6b). Tuition joins the normal 15th cycle.
create or replace function public.activate_enrolment(
  p_enrolment_id      uuid,
  p_assigned_tutor_id uuid,
  p_start_date        date default current_date,
  p_first_month_cents integer default null,
  p_reason            text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_admin     uuid := (select auth.uid());
  v_enrolment public.enrolments;
  v_guardian  uuid;
  v_account   uuid;
  v_invoice   uuid;
  v_fee       integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  select * into v_enrolment from public.enrolments where id = p_enrolment_id for update;
  if not found then raise exception 'Enrolment not found' using errcode = 'P0001'; end if;
  if v_enrolment.status <> 'pending' then
    raise exception 'Only a pending enrolment can be activated' using errcode = 'P0001';
  end if;

  select guardian_id into v_guardian
  from public.learner_guardians
  where learner_id = v_enrolment.learner_id and is_billing_contact;
  if v_guardian is null then
    raise exception 'Learner has no billing contact' using errcode = 'check_violation';
  end if;

  -- The consent and billing-contact triggers also guard this update.
  update public.enrolments
     set status                   = 'active',
         assigned_tutor_id        = p_assigned_tutor_id,
         start_date               = p_start_date,
         activated_at             = now(),
         first_month_amount_cents = p_first_month_cents,
         first_month_set_by       = case when p_first_month_cents is not null then v_admin end,
         first_month_reason       = p_reason
   where id = p_enrolment_id;

  update public.learners set status = 'active', joined_on = p_start_date
   where id = v_enrolment.learner_id and status = 'prospective';

  select id into v_account from public.billing_accounts where guardian_id = v_guardian;
  if v_account is null then
    insert into public.billing_accounts (guardian_id) values (v_guardian) returning id into v_account;
  end if;

  -- Registration is charged once per learner, not once per enrolment.
  if not exists (
    select 1 from public.invoice_lines l
    where l.learner_id = v_enrolment.learner_id and l.line_type = 'registration'
  ) then
    v_fee := public.package_price_on('registration', p_start_date);
    insert into public.invoices (billing_account_id, invoice_number, issued_on, due_on, status, notes)
    values (v_account, private.next_invoice_number(p_start_date), p_start_date, p_start_date, 'issued',
            'Registration fee')
    returning id into v_invoice;

    insert into public.invoice_lines (invoice_id, line_type, description, package_code, learner_id, unit_amount_cents)
    values (v_invoice, 'registration', 'Registration fee', 'registration', v_enrolment.learner_id, coalesce(v_fee, 0));
  end if;

  return v_invoice;
end;
$fn$;

revoke execute on function public.activate_enrolment(uuid, uuid, date, integer, text) from public, anon;
grant execute on function public.activate_enrolment(uuid, uuid, date, integer, text) to authenticated;

-- Generate the term's sessions ---------------------------------------------
-- Materialises one class_session per scheduled day inside the class's term.
-- Idempotent: re-running after adding a schedule fills only the gaps.
create or replace function public.generate_class_sessions(p_class_group_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $fn$
declare v_count integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  with created as (
    insert into public.class_sessions (class_group_id, schedule_id, session_date, starts_at, ends_at)
    select cg.id, s.id, d::date,
           -- The date and time are wall-clock at the centre; `at time zone`
           -- resolves them to the correct instant, including over DST.
           (d::date + s.starts_at_time) at time zone 'Africa/Johannesburg',
           (d::date + s.ends_at_time)   at time zone 'Africa/Johannesburg'
    from public.class_groups cg
    join public.terms t            on t.id = cg.term_id
    join public.class_schedules s  on s.class_group_id = cg.id
    cross join lateral generate_series(t.starts_on::timestamp, t.ends_on::timestamp, interval '1 day') d
    where cg.id = p_class_group_id
      and extract(isodow from d) = s.day_of_week
    on conflict (class_group_id, session_date, starts_at) do nothing
    returning 1
  )
  select count(*) into v_count from created;

  return v_count;
end;
$fn$;

revoke execute on function public.generate_class_sessions(uuid) from public, anon;
grant execute on function public.generate_class_sessions(uuid) to authenticated;
