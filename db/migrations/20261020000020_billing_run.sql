-- The monthly invoice run, payment recording and late fees.
--
-- Two columns are added first. Without them, "has this enrolment already been
-- billed for November?" and "has this invoice already attracted a late fee?"
-- can only be answered by parsing descriptions, which is not an answer. With
-- them, both become unique indexes, so double-billing is structurally
-- impossible rather than merely avoided by careful code.

alter table public.invoice_lines
  add column period_month date,
  add column late_fee_for_invoice_id uuid references public.invoices (id) on delete set null;

comment on column public.invoice_lines.period_month is
  'The month a package line covers, as its first day. Null for once-off lines.';
comment on column public.invoice_lines.late_fee_for_invoice_id is
  'The overdue invoice this late fee relates to, so it is charged only once.';

-- One package line per enrolment per month, ever.
create unique index invoice_line_one_per_enrolment_month
  on public.invoice_lines (enrolment_id, period_month)
  where line_type = 'package' and enrolment_id is not null and period_month is not null;

-- One late fee per overdue invoice, ever.
create unique index invoice_line_one_late_fee_per_invoice
  on public.invoice_lines (late_fee_for_invoice_id)
  where line_type = 'late_fee' and late_fee_for_invoice_id is not null;

-- A package line must say which month it covers; a late fee must say which
-- invoice it punishes. Otherwise the indexes above have nothing to bite on.
alter table public.invoice_lines
  add constraint invoice_line_period_required
    check (line_type <> 'package' or period_month is not null),
  add constraint invoice_line_late_fee_target_required
    check (line_type <> 'late_fee' or late_fee_for_invoice_id is not null);

-- The monthly run --------------------------------------------------------
-- Bills every active enrolment for the target month, and catches up any
-- earlier month that was never billed - which is how a learner who joined
-- after the 15th gets their part-month and the month between (SPEC 9.3).
create or replace function public.run_monthly_invoices(p_period date default null)
returns table (invoice_id uuid, billing_account_id uuid, total_cents bigint)
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_target   date;
  v_settings public.billing_settings;
  v_issued   date;
  v_due      date;
  v_enrol    record;
  v_month    date;
  v_amount   integer;
  v_account  uuid;
  v_invoice  uuid;
  v_touched  uuid[] := '{}';
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  v_target := date_trunc('month', coalesce(p_period, (current_date + interval '1 month')))::date;

  select * into v_settings from public.billing_settings
   where effective_from <= v_target and (effective_to is null or v_target < effective_to);
  if v_settings is null then
    raise exception 'No billing settings are in effect for %', v_target using errcode = 'P0001';
  end if;

  -- Issued on the 15th of the preceding month, due on the 1st of the target.
  v_issued := (v_target - interval '1 month')::date + (v_settings.issue_day - 1);
  v_due    := v_target + (v_settings.due_day - 1);

  for v_enrol in
    select e.id, e.learner_id, e.package_code, e.start_date, e.first_month_amount_cents,
           lg.guardian_id
    from public.enrolments e
    join public.learner_guardians lg
      on lg.learner_id = e.learner_id and lg.is_billing_contact
    join public.packages p on p.code = e.package_code
    where e.status = 'active'
      and e.start_date is not null
      and p.billing_period = 'monthly'
    order by lg.guardian_id, e.id
  loop
    -- Every month from the month the learner started to the target month.
    for v_month in
      select generate_series(date_trunc('month', v_enrol.start_date), v_target, interval '1 month')::date
    loop
      -- Already billed? The unique index guarantees it, but skipping keeps
      -- the run quiet rather than relying on a swallowed conflict.
      if exists (
        select 1 from public.invoice_lines
        where enrolment_id = v_enrol.id and period_month = v_month and line_type = 'package'
      ) then
        continue;
      end if;

      if v_month = date_trunc('month', v_enrol.start_date)::date
         and v_enrol.first_month_amount_cents is not null then
        v_amount := v_enrol.first_month_amount_cents;
      else
        v_amount := public.package_price_on(v_enrol.package_code, v_month);
      end if;

      -- A zero first month (a late-month joiner the admin waived) is recorded
      -- as billed so the catch-up never runs again, but no line is raised.
      if coalesce(v_amount, 0) = 0 then
        v_amount := 0;
      end if;

      select id into v_account from public.billing_accounts where guardian_id = v_enrol.guardian_id;
      if v_account is null then
        insert into public.billing_accounts (guardian_id) values (v_enrol.guardian_id)
        returning id into v_account;
      end if;

      -- One invoice per account per run. Looked up rather than tracked in a
      -- temp table, so re-running appends to the same invoice instead of
      -- raising a duplicate - and the function is safe to call twice in one
      -- transaction, which a temp table is not.
      select i.id into v_invoice
      from public.invoices i
      where i.billing_account_id = v_account
        and i.issued_on = v_issued
        and i.status = 'issued'
      order by i.created_at
      limit 1;

      if v_invoice is null then
        insert into public.invoices
          (billing_account_id, invoice_number, period_start, period_end, issued_on, due_on, status)
        values (v_account, private.next_invoice_number(v_issued), v_target,
                (v_target + interval '1 month - 1 day')::date, v_issued, v_due, 'issued')
        returning id into v_invoice;
      end if;

      v_touched := array_append(v_touched, v_invoice);

      insert into public.invoice_lines
        (invoice_id, line_type, description, enrolment_id, package_code, learner_id,
         period_month, unit_amount_cents)
      values (v_invoice, 'package',
              to_char(v_month, 'FMMonth YYYY') || ' tuition',
              v_enrol.id, v_enrol.package_code, v_enrol.learner_id, v_month, v_amount);
    end loop;
  end loop;

  return query
    select i.id, i.billing_account_id, coalesce(sum(l.line_total_cents), 0)::bigint
    from public.invoices i
    left join public.invoice_lines l on l.invoice_id = i.id
    where i.id = any(v_touched)
    group by i.id, i.billing_account_id;
end;
$fn$;

revoke execute on function public.run_monthly_invoices(date) from public, anon;
grant execute on function public.run_monthly_invoices(date) to authenticated;

-- Late fees ----------------------------------------------------------------
-- Charged on the NEXT invoice the account receives, not retrospectively onto
-- the overdue one, so an invoice total never changes after it was sent.
create or replace function public.apply_late_fees(p_on date default current_date)
returns integer
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_count integer := 0;
  v_row   record;
  v_invoice uuid;
  v_settings public.billing_settings;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  select * into v_settings from public.billing_settings
   where effective_from <= p_on and (effective_to is null or p_on < effective_to);
  if v_settings is null then return 0; end if;

  for v_row in
    select v.id, v.billing_account_id, v.invoice_number
    from public.v_invoice_status v
    where v.status = 'issued'
      and v.balance_cents > 0
      and p_on > v.due_on + v_settings.grace_days
      and not exists (
        select 1 from public.invoice_lines l
        where l.late_fee_for_invoice_id = v.id and l.line_type = 'late_fee')
  loop
    -- Attach to the newest unpaid invoice for the account, or raise one.
    select v.id into v_invoice
    from public.v_invoice_status v
    where v.billing_account_id = v_row.billing_account_id
      and v.status = 'issued' and v.issued_on >= p_on
    order by v.issued_on desc limit 1;

    if v_invoice is null then
      insert into public.invoices
        (billing_account_id, invoice_number, issued_on, due_on, status, notes)
      values (v_row.billing_account_id, private.next_invoice_number(p_on), p_on,
              p_on + v_settings.grace_days, 'issued', 'Late payment fee')
      returning id into v_invoice;
    end if;

    insert into public.invoice_lines
      (invoice_id, line_type, description, late_fee_for_invoice_id, unit_amount_cents)
    values (v_invoice, 'late_fee', 'Late payment fee — ' || v_row.invoice_number,
            v_row.id, v_settings.late_fee_cents);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

revoke execute on function public.apply_late_fees(date) from public, anon;
grant execute on function public.apply_late_fees(date) to authenticated;

-- Recording a payment ------------------------------------------------------
-- Allocates oldest invoice first, which is what a parent expects and what
-- keeps the arrears figure meaningful.
create or replace function public.record_payment(
  p_billing_account_id uuid,
  p_amount_cents       integer,
  p_method             text,
  p_reference          text default '',
  p_paid_on            date default current_date
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_payment   uuid;
  v_remaining integer := p_amount_cents;
  v_row       record;
  v_apply     integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;
  if p_amount_cents <= 0 then
    raise exception 'A payment must be more than zero' using errcode = 'check_violation';
  end if;

  insert into public.payments (billing_account_id, paid_on, amount_cents, method, reference, recorded_by)
  values (p_billing_account_id, p_paid_on, p_amount_cents, p_method, coalesce(p_reference, ''),
          (select auth.uid()))
  returning id into v_payment;

  for v_row in
    select v.id, v.balance_cents
    from public.v_invoice_status v
    where v.billing_account_id = p_billing_account_id
      and v.status = 'issued'
      and v.balance_cents > 0
    order by v.due_on, v.issued_on
  loop
    exit when v_remaining <= 0;
    v_apply := least(v_remaining, v_row.balance_cents);
    insert into public.payment_allocations (payment_id, invoice_id, amount_cents)
    values (v_payment, v_row.id, v_apply);
    v_remaining := v_remaining - v_apply;
  end loop;

  -- Anything left over stays unallocated and shows as a credit on the
  -- statement; it is allocated automatically by the next run.
  return v_payment;
end;
$fn$;

revoke execute on function public.record_payment(uuid, integer, text, text, date) from public, anon;
grant execute on function public.record_payment(uuid, integer, text, text, date) to authenticated;
