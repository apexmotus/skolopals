-- Pre-paid billing and the accept/decline decision.
-- SPEC-2026-11-enrolment-payments-ux.md §4.4 and §5; decisions D4, D8, D13, D15.
--
-- The old flow was: admin activates, which raises a registration invoice;
-- tuition joins the next monthly run. The new flow is:
--   pending  -- admin accepts --> accepted  (registration + pro-rata tuition invoiced, due now)
--   accepted -- payment verified --> active (no invoice raised here any more)
--   pending  -- admin declines --> declined (reason required, no invoice ever existed)
--   accepted -- 7 days unpaid --> declined ('Offer lapsed', invoice cancelled), may be re-accepted

-- Status and decision columns ------------------------------------------------
alter table public.enrolments drop constraint enrolments_status_check;
alter table public.enrolments add constraint enrolments_status_check
  check (status in ('pending', 'accepted', 'active', 'paused', 'ended', 'declined'));

alter table public.enrolments
  add column accepted_at      timestamptz,
  add column accepted_by      uuid references public.profiles (id),
  add column declined_at      timestamptz,
  add column decline_reason   text,
  add column offer_invoice_id uuid references public.invoices (id);

-- Applications declined before reasons existed.
update public.enrolments set decline_reason = 'Declined', declined_at = coalesce(declined_at, created_at)
 where status = 'declined' and decline_reason is null;

alter table public.enrolments
  add constraint enrolments_accepted_has_time check (status <> 'accepted' or accepted_at is not null),
  add constraint enrolments_accepted_has_invoice check (status <> 'accepted' or offer_invoice_id is not null),
  add constraint enrolments_declined_has_reason check (status <> 'declined' or decline_reason is not null);

comment on column public.enrolments.offer_invoice_id is
  'The invoice raised on acceptance (registration + pro-rata tuition). Paying it activates the enrolment. '
  'Replaced if the offer is re-quoted in a new month or re-accepted after lapsing.';
comment on column public.enrolments.first_month_amount_cents is
  'Retired by SPEC-2026-11 §5.2: the first month is now pro-rata from acceptance. Kept for history; '
  'admin discretion is a credit note.';

-- Cancelled invoices stop counting ------------------------------------------
-- A lapsed or re-quoted offer cancels its invoice. Its lines stay for the
-- record but must no longer block billing the same month again.
alter table public.invoice_lines add column voided_at timestamptz;

drop index public.invoice_line_one_per_enrolment_month;
create unique index invoice_line_one_per_enrolment_month
  on public.invoice_lines (enrolment_id, period_month)
  where line_type = 'package' and enrolment_id is not null and period_month is not null and voided_at is null;

create or replace function private.cancel_invoice(p_invoice_id uuid, p_note text)
returns void language plpgsql security definer set search_path = ''
as $fn$
begin
  if exists (select 1 from public.payment_allocations where invoice_id = p_invoice_id)
     or exists (select 1 from public.credit_note_allocations where invoice_id = p_invoice_id) then
    raise exception 'An invoice with payments against it cannot be cancelled' using errcode = 'P0001';
  end if;
  update public.invoices
     set status = 'cancelled',
         notes = trim(both from notes || ' ' || coalesce(p_note, ''))
   where id = p_invoice_id and status <> 'cancelled';
  update public.invoice_lines set voided_at = now() where invoice_id = p_invoice_id and voided_at is null;
end;
$fn$;

-- Notifications ------------------------------------------------------------
create or replace function private.notify(p_recipients uuid[], p_title text, p_body text)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_id uuid;
begin
  if coalesce(array_length(p_recipients, 1), 0) = 0 then return; end if;
  insert into public.notifications (title, body, created_by)
  values (p_title, coalesce(p_body, ''), (select auth.uid()))
  returning id into v_id;
  insert into public.notification_recipients (notification_id, profile_id)
  select v_id, r from (select distinct unnest(p_recipients) as r) x where r is not null;
end;
$fn$;

create or replace function private.guardian_ids(p_learner_id uuid)
returns uuid[] language sql stable security definer set search_path = ''
as $fn$ select coalesce(array_agg(guardian_id), '{}') from public.learner_guardians where learner_id = p_learner_id $fn$;

create or replace function private.admin_ids()
returns uuid[] language sql stable security definer set search_path = ''
as $fn$ select coalesce(array_agg(distinct user_id), '{}') from public.user_roles where role::text in ('admin', 'superadmin') $fn$;

-- Pro-rata -----------------------------------------------------------------
-- §5.1 / D8 / D13: tuition for the rest of the month counted from p_on, that
-- day included, rounded to the nearest whole rand. The single place that rounds.
create or replace function private.prorata_cents(p_monthly_cents integer, p_on date)
returns integer language sql immutable set search_path = ''
as $fn$
  select (round(
            p_monthly_cents::numeric
            * (extract(day from (date_trunc('month', p_on) + interval '1 month - 1 day'))::integer
               - extract(day from p_on)::integer + 1)
            / extract(day from (date_trunc('month', p_on) + interval '1 month - 1 day'))::integer
            / 100) * 100)::integer
$fn$;

-- Whether a learner has already been charged registration on a live invoice.
create or replace function private.registration_charged(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select p_learner_id is not null and exists (
    select 1 from public.invoice_lines l join public.invoices i on i.id = l.invoice_id
     where l.learner_id = p_learner_id and l.line_type = 'registration'
       and l.voided_at is null and i.status <> 'cancelled')
$fn$;

-- Quote ----------------------------------------------------------------------
-- What acceptance on p_on would cost. Used by the enrol wizard (an estimate),
-- the admin accept dialog and the offer invoice itself, so the number shown is
-- always the number billed. Monthly packages only are pro-rated; any other
-- billing period carries no tuition on the offer invoice.
create or replace function public.enrolment_quote(
  p_package_code text, p_on date default current_date, p_learner_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_period    text;
  v_monthly   integer;
  v_reg       integer := 0;
  v_tuition   integer := 0;
  v_dim       integer := extract(day from (date_trunc('month', p_on) + interval '1 month - 1 day'))::integer;
  v_days      integer := extract(day from (date_trunc('month', p_on) + interval '1 month - 1 day'))::integer
                         - extract(day from p_on)::integer + 1;
begin
  if p_learner_id is not null and not (select private.can_view_learner_private(p_learner_id)) then
    raise exception 'Learner not found' using errcode = 'P0001';
  end if;

  select billing_period into v_period from public.packages where code = p_package_code;
  if not found then
    raise exception 'Unknown package' using errcode = 'P0001';
  end if;

  if not private.registration_charged(p_learner_id) then
    v_reg := coalesce(public.package_price_on('registration', p_on), 0);
  end if;

  v_monthly := public.package_price_on(p_package_code, p_on);
  if v_period = 'monthly' and v_monthly is not null then
    v_tuition := private.prorata_cents(v_monthly, p_on);
  end if;

  return jsonb_build_object(
    'on', p_on,
    'registrationCents', v_reg,
    'monthlyCents', v_monthly,
    'tuitionCents', v_tuition,
    'daysCharged', case when v_period = 'monthly' then v_days else 0 end,
    'daysInMonth', v_dim,
    'periodStart', p_on,
    'periodEnd', (date_trunc('month', p_on) + interval '1 month - 1 day')::date,
    'totalCents', v_reg + v_tuition);
end;
$fn$;

revoke execute on function public.enrolment_quote(text, date, uuid) from public, anon;
grant execute on function public.enrolment_quote(text, date, uuid) to authenticated;

-- Offer invoice ------------------------------------------------------------
-- Raises the invoice for an acceptance (or a re-quote) on p_on and links it to
-- the enrolment. Due the same day: nothing is owed until the offer is made,
-- and the offer lapses after 7 days anyway.
create or replace function private.raise_offer_invoice(p_enrolment_id uuid, p_on date)
returns uuid language plpgsql security definer set search_path = ''
as $fn$
declare
  v_enrolment public.enrolments;
  v_guardian  uuid;
  v_account   uuid;
  v_invoice   uuid;
  v_quote     jsonb;
  v_month_end date := (date_trunc('month', p_on) + interval '1 month - 1 day')::date;
begin
  select * into v_enrolment from public.enrolments where id = p_enrolment_id;

  select guardian_id into v_guardian from public.learner_guardians
   where learner_id = v_enrolment.learner_id and is_billing_contact;
  if v_guardian is null then
    raise exception 'Learner has no billing contact' using errcode = 'check_violation';
  end if;

  select id into v_account from public.billing_accounts where guardian_id = v_guardian;
  if v_account is null then
    insert into public.billing_accounts (guardian_id) values (v_guardian) returning id into v_account;
  end if;

  v_quote := public.enrolment_quote(v_enrolment.package_code, p_on, v_enrolment.learner_id);

  insert into public.invoices
    (billing_account_id, invoice_number, period_start, period_end, issued_on, due_on, status, notes)
  values (v_account, private.next_invoice_number(p_on), p_on, v_month_end, p_on, p_on, 'issued',
          'Registration and first month')
  returning id into v_invoice;

  if (v_quote ->> 'registrationCents')::integer > 0 then
    insert into public.invoice_lines (invoice_id, line_type, description, package_code, learner_id, unit_amount_cents)
    values (v_invoice, 'registration', 'Registration fee', 'registration', v_enrolment.learner_id,
            (v_quote ->> 'registrationCents')::integer);
  end if;

  if (v_quote ->> 'tuitionCents')::integer > 0 then
    insert into public.invoice_lines
      (invoice_id, line_type, description, enrolment_id, package_code, learner_id, period_month, unit_amount_cents)
    values (v_invoice, 'package',
            format('%s tuition, %s–%s (%s of %s days)', to_char(p_on, 'FMMonth YYYY'),
                   extract(day from p_on)::integer, extract(day from v_month_end)::integer,
                   v_quote ->> 'daysCharged', v_quote ->> 'daysInMonth'),
            v_enrolment.id, v_enrolment.package_code, v_enrolment.learner_id,
            date_trunc('month', p_on)::date, (v_quote ->> 'tuitionCents')::integer);
  end if;

  update public.enrolments set offer_invoice_id = v_invoice where id = p_enrolment_id;
  return v_invoice;
end;
$fn$;

-- Accept -------------------------------------------------------------------
-- §4.4. Refused without a finished aptitude test and a report card (D15, no
-- override). A lapsed offer can be accepted again; that is a fresh quote and a
-- fresh 7 days.
create or replace function private.accept_enrolment_on(p_enrolment_id uuid, p_on date)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_enrolment public.enrolments;
  v_invoice   uuid;
  v_total     integer;
  v_name      text;
  v_expires   date := p_on + 7;
begin
  select * into v_enrolment from public.enrolments where id = p_enrolment_id for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0001';
  end if;
  if not (v_enrolment.status = 'pending'
          or (v_enrolment.status = 'declined' and v_enrolment.decline_reason = 'Offer lapsed')) then
    raise exception 'Only an application waiting for review, or a lapsed offer, can be accepted'
      using errcode = 'P0001';
  end if;

  -- The invoice first: an accepted application always has one (enrolments_accepted_has_invoice).
  v_invoice := private.raise_offer_invoice(p_enrolment_id, p_on);

  update public.enrolments
     set status = 'accepted',
         accepted_at = case when p_on = current_date then now()
                            else (p_on + time '10:00') at time zone 'Africa/Johannesburg' end,
         accepted_by = (select auth.uid()),
         declined_at = null,
         decline_reason = null
   where id = p_enrolment_id;
  select total_cents into v_total from public.v_invoice_status where id = v_invoice;
  select full_name into v_name from public.learners where id = v_enrolment.learner_id;

  perform private.notify(
    private.guardian_ids(v_enrolment.learner_id),
    format('%s''s application has been accepted', split_part(v_name, ' ', 1)),
    format('Please pay R%s by %s to secure the place. Open your portal to see the invoice and pay with PayShap.',
           to_char(v_total / 100.0, 'FM999G990D00'), to_char(v_expires, 'FMDy FMDD FMMon')));

  return jsonb_build_object('invoiceId', v_invoice, 'amountDueCents', v_total, 'offerExpiresOn', v_expires);
end;
$fn$;

create or replace function public.accept_enrolment(p_enrolment_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  return private.accept_enrolment_on(p_enrolment_id, current_date);
end;
$fn$;

-- Decline ------------------------------------------------------------------
create or replace function public.decline_enrolment(
  p_enrolment_id uuid, p_reason text, p_message text default null)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare
  v_enrolment public.enrolments;
  v_name      text;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Give a reason for declining' using errcode = 'check_violation';
  end if;

  select * into v_enrolment from public.enrolments where id = p_enrolment_id for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0001';
  end if;
  if v_enrolment.status <> 'pending' then
    raise exception 'Only an application waiting for review can be declined' using errcode = 'P0001';
  end if;

  update public.enrolments
     set status = 'declined', decline_reason = trim(p_reason), declined_at = now()
   where id = p_enrolment_id;

  select full_name into v_name from public.learners where id = v_enrolment.learner_id;
  perform private.notify(
    private.guardian_ids(v_enrolment.learner_id),
    format('Update on %s''s application', split_part(v_name, ' ', 1)),
    format('We are sorry, we cannot offer a place at this time. Reason: %s.%s', trim(p_reason),
           coalesce(E'\n\n' || nullif(trim(p_message), ''), '')));
end;
$fn$;

-- Activate -----------------------------------------------------------------
-- No longer raises any invoice (§5.2). Refused unless the offer was accepted
-- and its invoice is fully settled: pre-paid. Normally called by payment
-- verification; kept for an admin retry.
drop function public.activate_enrolment(uuid, uuid, date, integer, text);

create or replace function private.activate_enrolment_core(p_enrolment_id uuid, p_assigned_tutor_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare
  v_enrolment public.enrolments;
  v_invoice   record;
begin
  select * into v_enrolment from public.enrolments where id = p_enrolment_id for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0001';
  end if;
  if v_enrolment.status <> 'accepted' then
    raise exception 'Only an accepted application can be activated' using errcode = 'P0001';
  end if;

  select * into v_invoice from public.v_invoice_status where id = v_enrolment.offer_invoice_id;
  if v_invoice.balance_cents > 0 or v_invoice.status <> 'issued' then
    raise exception 'The first invoice must be paid before the learner can start' using errcode = 'check_violation';
  end if;

  update public.enrolments
     set status            = 'active',
         -- Tuition was charged from the acceptance (or re-quote) date, so that is when the place starts.
         start_date        = coalesce((select period_start from public.invoices where id = v_enrolment.offer_invoice_id),
                                      current_date),
         activated_at      = now(),
         assigned_tutor_id = coalesce(p_assigned_tutor_id, assigned_tutor_id)
   where id = p_enrolment_id;

  update public.learners set status = 'active', joined_on = current_date
   where id = v_enrolment.learner_id and status = 'prospective';
end;
$fn$;

create or replace function public.activate_enrolment(p_enrolment_id uuid, p_assigned_tutor_id uuid default null)
returns void language plpgsql security definer set search_path = ''
as $fn$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  perform private.activate_enrolment_core(p_enrolment_id, p_assigned_tutor_id);
end;
$fn$;

-- D15 and the pre-paid rule, whatever path changes the status ----------------
create or replace function private.enrolment_requires_aptitude()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    if not exists (select 1 from public.aptitude_attempts
                    where enrolment_id = new.id and status = 'completed') then
      raise exception 'The learner must finish the aptitude test before the application can be accepted'
        using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.learner_documents
                    where learner_id = new.learner_id and doc_type = 'report_card' and superseded_at is null) then
      raise exception 'A school report card is needed before the application can be accepted'
        using errcode = 'check_violation';
    end if;
  end if;
  if old.status = 'pending' and new.status = 'active' then
    raise exception 'An application must be accepted and paid before the learner can start'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

revoke execute on function
  private.cancel_invoice(uuid, text),
  private.notify(uuid[], text, text),
  private.guardian_ids(uuid),
  private.admin_ids(),
  private.registration_charged(uuid),
  private.raise_offer_invoice(uuid, date),
  private.accept_enrolment_on(uuid, date),
  private.activate_enrolment_core(uuid, uuid),
  public.accept_enrolment(uuid),
  public.decline_enrolment(uuid, text, text),
  public.activate_enrolment(uuid, uuid)
from public, anon;

grant execute on function
  public.accept_enrolment(uuid),
  public.decline_enrolment(uuid, text, text),
  public.activate_enrolment(uuid, uuid)
to authenticated;
