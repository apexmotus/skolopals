-- PayShap payments, automatic placement, offer expiry and derived progress.
-- SPEC-2026-11-enrolment-payments-ux.md §3, §4.5, §4.7, §5.3, §5.4;
-- decisions D2, D9, D12, D14.
--
-- There is no payment gateway: the parent pays in their banking app, uploads
-- proof, and an administrator verifies it. Verifying the offer invoice
-- activates the enrolment, places the learner in classes, and bills the next
-- month straight away if its run date has already passed.
--
-- Functions a parent's request reaches take storage paths, so they live in
-- `private` (API only), as in 20261124000002_aptitude.sql.

-- Centre's PayShap details ---------------------------------------------------
create table public.payment_settings (
  id             uuid primary key default gen_random_uuid(),
  payshap_id     text not null check (length(trim(payshap_id)) > 0),
  account_name   text not null check (length(trim(account_name)) > 0),
  bank_name      text not null default '',
  instructions   text not null default '',
  effective_from date not null,
  effective_to   date,
  check (effective_to is null or effective_to > effective_from),
  exclude using gist (daterange(effective_from, effective_to, '[)') with &&)
);

comment on table public.payment_settings is
  'The ShapID and account name parents pay to. Temporal like billing_settings: a change closes the '
  'current row and opens a new one, so what a parent was shown on a given day stays on record.';

alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from anon, authenticated;
grant select on public.payment_settings to authenticated;
create policy "payment settings: signed-in read" on public.payment_settings for select to authenticated using (true);

create or replace function public.set_payment_settings(
  p_payshap_id text, p_account_name text, p_bank_name text default '', p_instructions text default '')
returns uuid language plpgsql security definer set search_path = ''
as $fn$
declare v_current public.payment_settings; v_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  select * into v_current from public.payment_settings
   where effective_from <= current_date and (effective_to is null or current_date < effective_to) for update;

  if found and v_current.effective_from = current_date then
    update public.payment_settings
       set payshap_id = trim(p_payshap_id), account_name = trim(p_account_name),
           bank_name = coalesce(trim(p_bank_name), ''), instructions = coalesce(trim(p_instructions), '')
     where id = v_current.id;
    return v_current.id;
  end if;

  if found then
    update public.payment_settings set effective_to = current_date where id = v_current.id;
  end if;
  insert into public.payment_settings (payshap_id, account_name, bank_name, instructions, effective_from)
  values (trim(p_payshap_id), trim(p_account_name), coalesce(trim(p_bank_name), ''),
          coalesce(trim(p_instructions), ''), current_date)
  returning id into v_id;
  return v_id;
end;
$fn$;

-- Payments: PayShap method ---------------------------------------------------
alter table public.payments drop constraint payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('eft', 'cash', 'card_offline', 'payshap', 'other'));

-- Submissions ----------------------------------------------------------------
create table public.payment_submissions (
  id                   uuid primary key default gen_random_uuid(),
  invoice_id           uuid not null references public.invoices (id) on delete restrict,
  billing_account_id   uuid not null references public.billing_accounts (id) on delete restrict,
  submitted_by         uuid not null references public.profiles (id),
  marked_paid_at       timestamptz not null default now(),
  proof_storage_path   text unique,
  proof_mime           text check (proof_mime in ('application/pdf', 'image/jpeg', 'image/png')),
  proof_uploaded_at    timestamptz,
  claimed_amount_cents integer check (claimed_amount_cents > 0),
  claimed_paid_on      date,
  payer_reference      text not null default '',
  status               text not null default 'awaiting_proof'
    check (status in ('awaiting_proof', 'submitted', 'verified', 'rejected', 'withdrawn')),
  reviewed_by          uuid references public.profiles (id),
  reviewed_at          timestamptz,
  rejection_reason     text,
  withdrawn_note       text,
  payment_id           uuid unique references public.payments (id),
  created_at           timestamptz not null default now(),
  check (status not in ('submitted', 'verified', 'rejected') or proof_storage_path is not null),
  check ((status = 'verified') = (payment_id is not null)),
  check (status <> 'rejected' or rejection_reason is not null)
);

-- One open submission per invoice.
create unique index payment_submissions_one_open
  on public.payment_submissions (invoice_id) where status in ('awaiting_proof', 'submitted');
create index on public.payment_submissions (status, proof_uploaded_at);
create index on public.payment_submissions (billing_account_id);

alter table public.payment_submissions enable row level security;
revoke all on public.payment_submissions from anon, authenticated;
grant select on public.payment_submissions to authenticated;
create policy "payment submissions: account holder or admin read" on public.payment_submissions
  for select to authenticated
  using ((select private.is_admin())
         or exists (select 1 from public.billing_accounts ba
                     where ba.id = billing_account_id and ba.guardian_id = (select auth.uid())));

-- Placement provenance (§4.7) -------------------------------------------------
alter table public.class_enrolments
  add column placement_method text not null default 'admin' check (placement_method in ('auto', 'admin')),
  add column placed_by uuid references public.profiles (id);

-- Offer events (§5.4) ----------------------------------------------------------
-- What the daily job has already done for one acceptance, so it is done once.
-- Keyed by the acceptance time: a re-accepted offer gets its own reminder.
create table public.enrolment_offer_events (
  id                uuid primary key default gen_random_uuid(),
  enrolment_id      uuid not null references public.enrolments (id) on delete cascade,
  kind              text not null check (kind in ('reminder', 'lapsed')),
  offer_accepted_at timestamptz not null,
  sent_at           timestamptz not null default now(),
  unique (enrolment_id, kind, offer_accepted_at)
);

alter table public.enrolment_offer_events enable row level security;
revoke all on public.enrolment_offer_events from anon, authenticated;
grant select on public.enrolment_offer_events to authenticated;
create policy "enrolment offer events: admin read" on public.enrolment_offer_events
  for select to authenticated using ((select private.is_admin()));

-- Offer deadline -------------------------------------------------------------
-- 7 days from acceptance. A rejected proof gives the parent 2 more days from
-- the rejection. One definition, used by the job and the progress view.
create or replace function private.offer_deadline(p_enrolment_id uuid)
returns date language sql stable security definer set search_path = ''
as $fn$
  select greatest(
           (e.accepted_at at time zone 'Africa/Johannesburg')::date + 7,
           coalesce((select max(s.reviewed_at at time zone 'Africa/Johannesburg')::date + 2
                       from public.payment_submissions s
                      where s.invoice_id = e.offer_invoice_id and s.status = 'rejected'
                        and s.reviewed_at >= e.accepted_at),
                    (e.accepted_at at time zone 'Africa/Johannesburg')::date + 7))
    from public.enrolments e
   where e.id = p_enrolment_id and e.accepted_at is not null
$fn$;

-- Start a payment ("I have made the payment") --------------------------------
-- Returns the open submission for the invoice, creating one if needed. An
-- unpaid offer invoice from an earlier month is re-quoted first (§5.3): it is
-- cancelled and a fresh one raised from today, so the parent never pays for
-- days that have passed.
create or replace function private.start_payment_submission(p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_me        uuid := (select auth.uid());
  v_invoice   public.invoices;
  v_guardian  uuid;
  v_enrolment public.enrolments;
  v_requoted  boolean := false;
  v_sub       public.payment_submissions;
  v_balance   integer;
  v_new_id    uuid;
begin
  perform private.assert_not_rest();

  select i.* into v_invoice from public.invoices i where i.id = p_invoice_id for update;
  select guardian_id into v_guardian from public.billing_accounts where id = v_invoice.billing_account_id;
  if v_invoice.id is null or v_guardian is distinct from v_me then
    raise exception 'Invoice not found' using errcode = 'P0001';
  end if;

  select * into v_enrolment from public.enrolments
   where offer_invoice_id = p_invoice_id and status = 'accepted' for update;

  if v_enrolment.id is not null
     and date_trunc('month', v_invoice.issued_on) < date_trunc('month', current_date)
     and not exists (select 1 from public.payment_allocations where invoice_id = p_invoice_id)
     and not exists (select 1 from public.payment_submissions where invoice_id = p_invoice_id and status = 'submitted') then
    update public.payment_submissions
       set status = 'withdrawn', withdrawn_note = 'The invoice was re-quoted for the new month'
     where invoice_id = p_invoice_id and status = 'awaiting_proof';
    perform private.cancel_invoice(p_invoice_id, format('Re-quoted on %s.', current_date));
    v_new_id := private.raise_offer_invoice(v_enrolment.id, current_date);
    select * into v_invoice from public.invoices where id = v_new_id;
    v_requoted := true;
  end if;

  if v_invoice.status <> 'issued' then
    raise exception 'This invoice cannot be paid' using errcode = 'P0001';
  end if;

  select * into v_sub from public.payment_submissions
   where invoice_id = v_invoice.id and status in ('awaiting_proof', 'submitted');
  if v_sub.id is null then
    select balance_cents into v_balance from public.v_invoice_status where id = v_invoice.id;
    if v_balance <= 0 then
      raise exception 'This invoice is already paid' using errcode = 'P0001';
    end if;
    insert into public.payment_submissions (invoice_id, billing_account_id, submitted_by)
    values (v_invoice.id, v_invoice.billing_account_id, v_me)
    returning * into v_sub;
  end if;

  return jsonb_build_object('submissionId', v_sub.id, 'invoiceId', v_invoice.id,
                            'status', v_sub.status, 'requoted', v_requoted);
end;
$fn$;

-- Attach proof -----------------------------------------------------------------
-- The proof must be the caller's own confirmed staging upload. Returns where
-- the API must move it: {billing_account_id}/{submission_id}/{uuid}.{ext}.
create or replace function private.attach_payment_proof(p_submission_id uuid, p_proof jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_me      uuid := (select auth.uid());
  v_sub     public.payment_submissions;
  v_staging text := p_proof ->> 'stagingPath';
  v_path    text;
  v_name    text;
begin
  perform private.assert_not_rest();

  select s.* into v_sub from public.payment_submissions s
    join public.billing_accounts ba on ba.id = s.billing_account_id
   where s.id = p_submission_id and ba.guardian_id = v_me
   for update of s;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0001';
  end if;
  if v_sub.status <> 'awaiting_proof' then
    raise exception 'Proof has already been sent for this payment' using errcode = 'P0001';
  end if;
  if coalesce(v_staging, '') !~ ('^staging/' || v_me::text || '/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$') then
    raise exception 'That upload does not belong to you' using errcode = 'P0001';
  end if;

  v_path := format('%s/%s/%s.%s', v_sub.billing_account_id, v_sub.id, gen_random_uuid(),
                   substring(v_staging from '\.([a-z]+)$'));

  update public.payment_submissions
     set proof_storage_path   = v_path,
         proof_mime           = p_proof ->> 'mime',
         proof_uploaded_at    = now(),
         claimed_amount_cents = nullif(p_proof ->> 'claimedAmountCents', '')::integer,
         claimed_paid_on      = nullif(p_proof ->> 'claimedPaidOn', '')::date,
         payer_reference      = left(coalesce(p_proof ->> 'payerReference', ''), 100),
         status               = 'submitted'
   where id = v_sub.id;

  select full_name into v_name from public.profiles where id = v_me;
  perform private.notify(private.admin_ids(), 'Proof of payment to check',
    format('%s sent proof of payment. Open Payments to verify it.', coalesce(v_name, 'A parent')));

  return jsonb_build_object('stagingPath', v_staging, 'storagePath', v_path);
end;
$fn$;

-- Proof for review ----------------------------------------------------------
-- The account holder or an administrator; returns where the file is for the
-- API's signed URL.
create or replace function private.payment_proof_location(p_submission_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare v_sub public.payment_submissions; v_guardian uuid;
begin
  perform private.assert_not_rest();
  select * into v_sub from public.payment_submissions where id = p_submission_id;
  select guardian_id into v_guardian from public.billing_accounts where id = v_sub.billing_account_id;
  if v_sub.id is null or v_sub.proof_storage_path is null
     or not ((select private.is_admin()) or v_guardian = (select auth.uid())) then
    raise exception 'Proof not found' using errcode = 'P0001';
  end if;
  return jsonb_build_object('storagePath', v_sub.proof_storage_path, 'mime', v_sub.proof_mime);
end;
$fn$;

-- Payment against one invoice ------------------------------------------------
-- Like record_payment, but settles the given invoice first and only then
-- spreads any remainder oldest-first. A family's older unpaid invoice must not
-- swallow the payment for a place and leave the child unactivated.
create or replace function private.record_payment_for_invoice(
  p_invoice_id uuid, p_amount_cents integer, p_method text, p_reference text, p_paid_on date)
returns uuid language plpgsql security definer set search_path = ''
as $fn$
declare
  v_account   uuid;
  v_payment   uuid;
  v_remaining integer := p_amount_cents;
  v_apply     integer;
  v_row       record;
begin
  if p_amount_cents <= 0 then
    raise exception 'A payment must be more than zero' using errcode = 'check_violation';
  end if;
  select billing_account_id into v_account from public.invoices where id = p_invoice_id;

  insert into public.payments (billing_account_id, paid_on, amount_cents, method, reference, recorded_by)
  values (v_account, p_paid_on, p_amount_cents, p_method, coalesce(p_reference, ''), (select auth.uid()))
  returning id into v_payment;

  for v_row in
    select v.id, v.balance_cents from public.v_invoice_status v
     where v.billing_account_id = v_account and v.status = 'issued' and v.balance_cents > 0
     order by (v.id = p_invoice_id) desc, v.due_on, v.issued_on
  loop
    exit when v_remaining <= 0;
    v_apply := least(v_remaining, v_row.balance_cents);
    insert into public.payment_allocations (payment_id, invoice_id, amount_cents)
    values (v_payment, v_row.id, v_apply);
    v_remaining := v_remaining - v_apply;
  end loop;
  return v_payment;
end;
$fn$;

-- Automatic placement (§4.7, D12) ---------------------------------------------
create or replace function private.auto_place_enrolment(p_enrolment_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_enrolment public.enrolments;
  v_grade     text;
  v_term      uuid;
  v_term_from date;
  v_subject   record;
  v_class     public.class_groups;
  v_in        uuid[];
  v_placed    jsonb := '[]'::jsonb;
  v_unplaced  jsonb := '[]'::jsonb;
  v_first     uuid;
  v_pref_got  boolean := false;
begin
  select * into v_enrolment from public.enrolments where id = p_enrolment_id;
  select grade_code into v_grade from public.learners where id = v_enrolment.learner_id;

  -- The term in progress, or the next one if the centre is between terms.
  select id, starts_on into v_term, v_term_from from public.terms
   where ends_on >= current_date order by (starts_on <= current_date) desc, starts_on limit 1;

  select coalesce(array_agg(class_group_id), '{}') into v_in
    from public.class_enrolments where learner_id = v_enrolment.learner_id and left_on is null;

  -- Subjects the preferred tutor has a class for go first, so another subject
  -- cannot take the time slot the family's preferred class needs.
  for v_subject in
    select es.subject_code, es.preferred_language_code, s.name
      from public.enrolment_subjects es join public.subjects s on s.code = es.subject_code
     where es.enrolment_id = p_enrolment_id
     order by exists (select 1 from public.class_groups cg
                       where cg.is_active and cg.term_id = v_term and cg.subject_code = es.subject_code
                         and cg.tutor_id = v_enrolment.preferred_tutor_id) desc,
              s.name
  loop
    if exists (select 1 from public.class_groups cg where cg.id = any(v_in) and cg.subject_code = v_subject.subject_code) then
      continue;
    end if;

    select cg.* into v_class
      from public.class_groups cg
     where cg.is_active and cg.term_id = v_term
       and cg.subject_code = v_subject.subject_code
       and (v_subject.preferred_language_code is null or cg.language_code = v_subject.preferred_language_code)
       and exists (select 1 from public.class_group_grades g where g.class_group_id = cg.id and g.grade_code = v_grade)
       and cg.capacity > (select count(*) from public.class_enrolments ce
                           where ce.class_group_id = cg.id and ce.left_on is null)
       and not exists (
         select 1 from public.class_schedules a
           join public.class_schedules b on b.day_of_week = a.day_of_week
          where a.class_group_id = cg.id and b.class_group_id = any(v_in)
            and a.starts_at_time < b.ends_at_time and b.starts_at_time < a.ends_at_time)
     order by (cg.tutor_id = v_enrolment.preferred_tutor_id) desc nulls last,
              cg.capacity - (select count(*) from public.class_enrolments ce
                              where ce.class_group_id = cg.id and ce.left_on is null) desc,
              cg.created_at
     limit 1
     for update of cg;

    if v_class.id is null then
      v_unplaced := v_unplaced || jsonb_build_object('subjectCode', v_subject.subject_code, 'subjectName', v_subject.name);
    else
      insert into public.class_enrolments (class_group_id, learner_id, enrolment_id, joined_on, placement_method)
      values (v_class.id, v_enrolment.learner_id, p_enrolment_id, greatest(current_date, v_term_from), 'auto');
      v_in := v_in || v_class.id;
      v_placed := v_placed || jsonb_build_object('subjectCode', v_subject.subject_code, 'subjectName', v_subject.name,
                                                 'classGroupId', v_class.id, 'className', v_class.name);
      v_first := coalesce(v_first, v_class.tutor_id);
      v_pref_got := v_pref_got or v_class.tutor_id = v_enrolment.preferred_tutor_id;
    end if;
    v_class := null;
  end loop;

  -- The preferred tutor if they got one of the classes, else the first class's tutor.
  if v_enrolment.assigned_tutor_id is null and v_first is not null then
    update public.enrolments
       set assigned_tutor_id = case when v_pref_got then v_enrolment.preferred_tutor_id else v_first end
     where id = p_enrolment_id;
  end if;

  return jsonb_build_object('placed', v_placed, 'unplaced', v_unplaced);
end;
$fn$;

-- Bill the months after activation (§5.3, D9) ---------------------------------
-- Tuition for any month from the start up to the verification month that has
-- none yet, plus next month if its run date (issue_day) has already passed.
create or replace function private.bill_after_activation(p_enrolment_id uuid, p_on date)
returns uuid language plpgsql security definer set search_path = ''
as $fn$
declare
  v_enrolment public.enrolments;
  v_settings  public.billing_settings;
  v_through   date := date_trunc('month', p_on)::date;
  v_months    date[];
  v_month     date;
  v_account   uuid;
  v_invoice   uuid;
begin
  select * into v_enrolment from public.enrolments where id = p_enrolment_id;
  if v_enrolment.start_date is null
     or (select billing_period from public.packages where code = v_enrolment.package_code) <> 'monthly' then
    return null;
  end if;

  select * into v_settings from public.billing_settings
   where effective_from <= p_on and (effective_to is null or p_on < effective_to);
  if v_settings.id is not null and extract(day from p_on) >= v_settings.issue_day then
    v_through := (v_through + interval '1 month')::date;
  end if;

  select coalesce(array_agg(g.m::date order by g.m), '{}') into v_months
    from generate_series(date_trunc('month', v_enrolment.start_date), v_through, interval '1 month') as g(m)
   where not exists (select 1 from public.invoice_lines l
                      where l.enrolment_id = p_enrolment_id and l.period_month = g.m::date
                        and l.line_type = 'package' and l.voided_at is null);
  if coalesce(array_length(v_months, 1), 0) = 0 then
    return null;
  end if;

  select ba.id into v_account from public.billing_accounts ba
    join public.learner_guardians lg on lg.guardian_id = ba.guardian_id and lg.is_billing_contact
   where lg.learner_id = v_enrolment.learner_id;

  insert into public.invoices
    (billing_account_id, invoice_number, period_start, period_end, issued_on, due_on, status, notes)
  values (v_account, private.next_invoice_number(p_on), v_months[1],
          (v_months[array_length(v_months, 1)] + interval '1 month - 1 day')::date,
          p_on, greatest(p_on, v_months[1]), 'issued', 'Tuition')
  returning id into v_invoice;

  foreach v_month in array v_months loop
    insert into public.invoice_lines
      (invoice_id, line_type, description, enrolment_id, package_code, learner_id, period_month, unit_amount_cents)
    values (v_invoice, 'package', to_char(v_month, 'FMMonth YYYY') || ' tuition', p_enrolment_id,
            v_enrolment.package_code, v_enrolment.learner_id, v_month,
            coalesce(public.package_price_on(v_enrolment.package_code, v_month), 0));
  end loop;
  return v_invoice;
end;
$fn$;

-- Verify -----------------------------------------------------------------------
-- Records the PayShap payment against the invoice. For an offer invoice that is
-- now settled: activates the enrolment, places the learner, bills any month
-- now due, and tells the family. Verifying twice is refused with who and when.
create or replace function private.verify_payment_submission(
  p_submission_id uuid, p_amount_cents integer, p_paid_on date, p_reference text)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_sub        public.payment_submissions;
  v_payment    uuid;
  v_enrolment  public.enrolments;
  v_balance    integer;
  v_placement  jsonb;
  v_next       uuid;
  v_name       text;
  v_by         text;
  v_guardians  uuid[];
  v_unplaced   text;
begin
  perform private.assert_not_rest();
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  select * into v_sub from public.payment_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0001';
  end if;
  if v_sub.status = 'verified' then
    select full_name into v_by from public.profiles where id = v_sub.reviewed_by;
    raise exception 'Already verified by % at %', coalesce(v_by, 'an administrator'),
      to_char(v_sub.reviewed_at at time zone 'Africa/Johannesburg', 'HH24:MI on FMDD FMMon')
      using errcode = 'P0001';
  end if;
  if v_sub.status <> 'submitted' then
    raise exception 'Only a payment with proof sent can be verified' using errcode = 'P0001';
  end if;

  v_payment := private.record_payment_for_invoice(v_sub.invoice_id, p_amount_cents, 'payshap',
                                                   coalesce(nullif(trim(p_reference), ''), v_sub.payer_reference),
                                                   coalesce(p_paid_on, current_date));

  update public.payment_submissions
     set status = 'verified', payment_id = v_payment, reviewed_by = (select auth.uid()), reviewed_at = now()
   where id = p_submission_id;

  v_guardians := array[(select guardian_id from public.billing_accounts where id = v_sub.billing_account_id)];
  select balance_cents into v_balance from public.v_invoice_status where id = v_sub.invoice_id;

  select * into v_enrolment from public.enrolments
   where offer_invoice_id = v_sub.invoice_id and status = 'accepted' for update;

  if v_enrolment.id is not null and v_balance <= 0 then
    perform private.activate_enrolment_core(v_enrolment.id, null);
    v_placement := private.auto_place_enrolment(v_enrolment.id);
    v_next := private.bill_after_activation(v_enrolment.id, current_date);
    select full_name into v_name from public.learners where id = v_enrolment.learner_id;

    select string_agg(x ->> 'subjectName', ', ') into v_unplaced from jsonb_array_elements(v_placement -> 'unplaced') x;
    perform private.notify(private.guardian_ids(v_enrolment.learner_id),
      format('Payment confirmed: %s is enrolled', split_part(v_name, ' ', 1)),
      'Thank you, your payment has been confirmed. ' ||
      case when v_unplaced is null then 'Your timetable is in the portal.'
           else format('We''re finalising %s''s %s class and will let you know.', split_part(v_name, ' ', 1), v_unplaced) end ||
      case when v_next is not null then ' The next month''s invoice is also in your account.' else '' end);
    if v_unplaced is not null then
      perform private.notify(private.admin_ids(), format('%s needs placing', v_name),
        format('No suitable class with a free seat was found for: %s.', v_unplaced));
    end if;
  else
    perform private.notify(v_guardians, 'Payment received',
      case when v_balance > 0
           then format('Thank you, we received your payment. R%s is still due on this invoice.',
                       to_char(v_balance / 100.0, 'FM999G990D00'))
           else 'Thank you, your payment has been confirmed.' end);
  end if;

  return jsonb_build_object('paymentId', v_payment,
                            'activated', v_enrolment.id is not null and v_balance <= 0,
                            'placement', v_placement,
                            'nextInvoiceId', v_next);
end;
$fn$;

-- Reject -------------------------------------------------------------------------
create or replace function private.reject_payment_submission(p_submission_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_sub public.payment_submissions;
begin
  perform private.assert_not_rest();
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Give a reason so the parent knows what to fix' using errcode = 'check_violation';
  end if;

  select * into v_sub from public.payment_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0001';
  end if;
  if v_sub.status <> 'submitted' then
    raise exception 'Only a payment with proof sent can be rejected' using errcode = 'P0001';
  end if;

  update public.payment_submissions
     set status = 'rejected', rejection_reason = trim(p_reason), reviewed_by = (select auth.uid()), reviewed_at = now()
   where id = p_submission_id;

  perform private.notify(array[(select guardian_id from public.billing_accounts where id = v_sub.billing_account_id)],
    'We could not confirm your payment',
    format('Reason: %s. Please check and upload a new proof of payment from your portal.', trim(p_reason)));
end;
$fn$;

-- Daily offer job (§5.4, D14) --------------------------------------------------------
-- Day 3: one reminder. Deadline (day 7, or 2 days after a rejected proof): the
-- offer lapses, unless a proof is waiting to be checked. Idempotent, so a
-- missed or repeated run is safe. Called by the API's cron endpoint, which has
-- no signed-in user, so it is granted to anon; `private` keeps it off REST.
create or replace function private.process_enrolment_offers(p_on date default current_date)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_row      record;
  v_reminded integer := 0;
  v_lapsed   integer := 0;
  v_name     text;
begin
  perform private.assert_not_rest();
  if p_on > current_date then
    raise exception 'The offer job cannot run for a future date' using errcode = 'P0001';
  end if;

  for v_row in
    select e.id, e.learner_id, e.accepted_at, e.offer_invoice_id,
           (e.accepted_at at time zone 'Africa/Johannesburg')::date as accepted_on,
           private.offer_deadline(e.id) as deadline,
           v.balance_cents,
           exists (select 1 from public.payment_submissions s
                    where s.invoice_id = e.offer_invoice_id and s.status = 'submitted') as waiting
      from public.enrolments e
      join public.v_invoice_status v on v.id = e.offer_invoice_id
     where e.status = 'accepted' and v.balance_cents > 0
  loop
    continue when v_row.waiting;
    select full_name into v_name from public.learners where id = v_row.learner_id;

    if p_on >= v_row.deadline then
      update public.enrolments
         set status = 'declined', decline_reason = 'Offer lapsed', declined_at = now()
       where id = v_row.id and status = 'accepted';
      continue when not found;  -- paid or decided by someone else in the meantime
      update public.payment_submissions
         set status = 'withdrawn', withdrawn_note = 'The offer lapsed'
       where invoice_id = v_row.offer_invoice_id and status = 'awaiting_proof';
      perform private.cancel_invoice(v_row.offer_invoice_id, 'Offer lapsed.');
      insert into public.enrolment_offer_events (enrolment_id, kind, offer_accepted_at)
      values (v_row.id, 'lapsed', v_row.accepted_at) on conflict do nothing;
      perform private.notify(private.guardian_ids(v_row.learner_id),
        format('%s''s offer has lapsed', split_part(v_name, ' ', 1)),
        'We did not receive payment in time, so the place has been released. Please contact the centre if you would still like a place.');
      perform private.notify(private.admin_ids(), format('Offer lapsed: %s', v_name),
        'The offer was not paid in time. You can accept the application again from the Declined tab.');
      v_lapsed := v_lapsed + 1;

    elsif p_on >= v_row.accepted_on + 3
          and not exists (select 1 from public.enrolment_offer_events
                           where enrolment_id = v_row.id and kind = 'reminder' and offer_accepted_at = v_row.accepted_at) then
      insert into public.enrolment_offer_events (enrolment_id, kind, offer_accepted_at)
      values (v_row.id, 'reminder', v_row.accepted_at);
      perform private.notify(private.guardian_ids(v_row.learner_id),
        format('Reminder: secure %s''s place', split_part(v_name, ' ', 1)),
        format('Please pay R%s by %s, or the place will be released. Open your portal to pay with PayShap.',
               to_char(v_row.balance_cents / 100.0, 'FM999G990D00'), to_char(v_row.deadline, 'FMDy FMDD FMMon')));
      v_reminded := v_reminded + 1;
    end if;
  end loop;

  return jsonb_build_object('on', p_on, 'reminded', v_reminded, 'lapsed', v_lapsed);
end;
$fn$;

-- Derived progress (§4.5) ---------------------------------------------------------
-- The stage is worked out from facts every time, never stored.
create or replace view public.v_enrolment_progress with (security_invoker = true) as
select
  e.id as enrolment_id,
  e.learner_id,
  e.status,
  case
    when e.status = 'declined' then 'declined'
    when e.status = 'pending' and not exists (
      select 1 from public.learner_documents d
       where d.learner_id = e.learner_id and d.doc_type = 'report_card' and d.superseded_at is null) then 'details'
    when e.status = 'pending' and not exists (
      select 1 from public.aptitude_attempts a where a.enrolment_id = e.id and a.status = 'completed') then 'assessment'
    when e.status = 'pending' then 'review'
    when e.status = 'accepted' and sub.status = 'submitted' then 'verification'
    when e.status = 'accepted' and sub.status = 'awaiting_proof' then 'proof'
    when e.status = 'accepted' and coalesce(inv.balance_cents, 1) > 0 then 'payment'
    when e.status = 'accepted' then 'activation'
    when e.status = 'active' and exists (
      select 1 from public.enrolment_subjects es
       where es.enrolment_id = e.id
         and not exists (select 1 from public.class_enrolments ce
                           join public.class_groups cg on cg.id = ce.class_group_id
                          where ce.learner_id = e.learner_id and ce.left_on is null
                            and cg.subject_code = es.subject_code)) then 'needs_placement'
    else e.status
  end as stage,
  e.accepted_at,
  case when e.status = 'accepted' then private.offer_deadline(e.id) end as offer_expires_on,
  e.offer_invoice_id,
  inv.balance_cents as offer_balance_cents,
  sub.id as open_submission_id,
  sub.status as submission_status,
  e.decline_reason,
  e.created_at
from public.enrolments e
left join public.v_invoice_status inv on inv.id = e.offer_invoice_id
left join public.payment_submissions sub
  on sub.invoice_id = e.offer_invoice_id and sub.status in ('awaiting_proof', 'submitted');

comment on view public.v_enrolment_progress is
  'Where each application is, derived from stored facts (SPEC-2026-11 §4.5). Feeds the parent '
  '"Continue" card, the journey header and the admin Applications tabs.';

grant select on public.v_enrolment_progress to authenticated;

revoke execute on function
  public.set_payment_settings(text, text, text, text),
  private.offer_deadline(uuid),
  private.start_payment_submission(uuid),
  private.attach_payment_proof(uuid, jsonb),
  private.payment_proof_location(uuid),
  private.record_payment_for_invoice(uuid, integer, text, text, date),
  private.auto_place_enrolment(uuid),
  private.bill_after_activation(uuid, date),
  private.verify_payment_submission(uuid, integer, date, text),
  private.reject_payment_submission(uuid, text),
  private.process_enrolment_offers(date)
from public, anon;

grant execute on function
  public.set_payment_settings(text, text, text, text),
  private.offer_deadline(uuid),
  private.start_payment_submission(uuid),
  private.attach_payment_proof(uuid, jsonb),
  private.payment_proof_location(uuid),
  private.verify_payment_submission(uuid, integer, date, text),
  private.reject_payment_submission(uuid, text)
to authenticated;

grant execute on function private.process_enrolment_offers(date) to anon, authenticated;
