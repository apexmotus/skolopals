#!/usr/bin/env bash
# A month closes: the 15th run issues invoices, payments are recorded and
# allocated, late fees land on the next invoice, and the surplus reports.
# Reproduces SPEC 9.3 through the real invoice run. Rolls back.
set -euo pipefail
DB="${DATABASE_URL:?DATABASE_URL not set}"

psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
set constraints all immediate;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','parent@test','{"full_name":"Thandi Mokoena"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002','other@test','{"full_name":"Sipho Nkosi"}'),
  ('dddddddd-0000-0000-0000-000000000004','admin@test','{"full_name":"Winnie Thobela"}');
insert into public.user_roles values ('dddddddd-0000-0000-0000-000000000004','admin');

-- Two children in one family, one in another.
insert into public.learners (id, full_name, date_of_birth, grade_code, status) values
  ('11111111-0000-0000-0000-00000000000a','Thabo','2013-04-02','grade_7','active'),
  ('22222222-0000-0000-0000-00000000000b','Lerato','2015-04-02','grade_5','active'),
  ('33333333-0000-0000-0000-00000000000c','Sipho Jr','2014-04-02','grade_6','active');
insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact) values
  ('11111111-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','mother',true,true),
  ('22222222-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','mother',true,true),
  ('33333333-0000-0000-0000-00000000000c','bbbbbbbb-0000-0000-0000-000000000002','father',true,true);
insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
select ct.code, lg.guardian_id, lg.learner_id, true, '1.0'
from public.consent_types ct cross join public.learner_guardians lg where ct.is_required;

-- Thabo joined 18 October (after the 15th run), part month set to R400.
insert into public.enrolments (id, learner_id, package_code, status, start_date,
                               first_month_amount_cents, first_month_set_by, first_month_reason)
values ('aaaa1111-0000-0000-0000-000000000013','11111111-0000-0000-0000-00000000000a','group_2','active',
        '2026-10-18', 40000, 'dddddddd-0000-0000-0000-000000000004','Joined 18 Oct, part month');
-- Lerato and Sipho Jr started on time in November.
insert into public.enrolments (id, learner_id, package_code, status, start_date) values
  ('aaaa1111-0000-0000-0000-000000000023','22222222-0000-0000-0000-00000000000b','group_1','active','2026-11-01'),
  ('aaaa1111-0000-0000-0000-000000000033','33333333-0000-0000-0000-00000000000c','group_1','active','2026-11-01');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}',true);

\echo ''
\echo '=== The 15 November run, billing December ==='
select count(*) as invoices_raised from public.run_monthly_invoices('2026-12-01') \gset
do $$ begin
  perform dev.assert((select count(*) from public.invoices) = 2,
    'one invoice per FAMILY, not per learner');
  perform dev.assert((select count(distinct billing_account_id) from public.invoices) = 2,
    'two billing accounts');
  perform dev.assert((select issued_on from public.invoices limit 1) = '2026-11-15',
    'issued on the 15th of the preceding month');
  perform dev.assert((select due_on from public.invoices limit 1) = '2026-12-01',
    'due on the 1st of the billed month');
end $$;

do $$
declare v_total bigint; v_lines integer;
begin
  select v.total_cents into v_total
  from public.v_invoice_status v
  join public.billing_accounts ba on ba.id = v.billing_account_id
  where ba.guardian_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  select count(*) into v_lines
  from public.invoice_lines l
  join public.invoices i on i.id = l.invoice_id
  join public.billing_accounts ba on ba.id = i.billing_account_id
  where ba.guardian_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  -- Thabo: Oct R400 (part) + Nov R750 + Dec R750. Lerato: Nov R450 + Dec R450.
  perform dev.assert(v_total = 280000,
    'the catch-up run bills every unbilled month: R2,800 across two children');
  perform dev.assert(v_lines = 5, 'five lines for this family, each naming its month and learner');
  perform dev.assert((select count(*) from public.invoice_lines
                      where enrolment_id='aaaa1111-0000-0000-0000-000000000013'
                        and period_month='2026-10-01' and unit_amount_cents=40000) = 1,
    'October is the admin-set part month, not the full R750');
end $$;

\echo ''
\echo '--- re-running the same period changes nothing ---'
select count(*) as second_run from public.run_monthly_invoices('2026-12-01') \gset
do $$ begin
  -- Seven across all three enrolments: Thabo Oct+Nov+Dec, Lerato and
  -- Sipho Jr Nov+Dec each. The five above was this family's share.
  perform dev.assert((select count(*) from public.invoice_lines where line_type='package') = 7,
    'still seven package lines - the unique index makes double-billing impossible');
end $$;

\echo ''
\echo '=== AC-08: one payment settles several invoices across two children ==='
do $$
declare v_account uuid; v_payment uuid;
begin
  select id into v_account from public.billing_accounts
   where guardian_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  v_payment := public.record_payment(v_account, 280000, 'eft', 'EFT-99812', '2026-12-02');

  perform dev.assert((select count(*) from public.payment_allocations where payment_id = v_payment) = 1,
    'allocated against the family invoice');
  perform dev.assert((select sum(balance_cents) from public.v_invoice_status
                      where billing_account_id = v_account) = 0,
    'the family account is settled');
  perform dev.assert((select payment_state from public.v_invoice_status
                      where billing_account_id = v_account) = 'paid', 'shown as paid');
end $$;

\echo ''
\echo '--- a part payment allocates oldest first and leaves the rest open ---'
do $$
declare v_account uuid;
begin
  select id into v_account from public.billing_accounts
   where guardian_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  perform public.record_payment(v_account, 50000, 'cash', 'Cash receipt 7', '2026-12-02');
  perform dev.assert((select payment_state from public.v_invoice_status
                      where billing_account_id = v_account) = 'part_paid',
    'R500 against R900 is a part payment');
  perform dev.assert((select balance_cents from public.v_invoice_status
                      where billing_account_id = v_account) = 40000, 'R400 still outstanding');
end $$;

\echo ''
\echo '=== Late fees: 3 days grace, charged once, on the NEXT invoice ==='
do $$
declare v_charged integer;
begin
  perform dev.assert(public.apply_late_fees('2026-12-04') = 0, 'nothing on day 3 of grace');
  v_charged := public.apply_late_fees('2026-12-05');
  perform dev.assert(v_charged = 1, 'one overdue account charged on day 4');
  perform dev.assert((select count(*) from public.invoice_lines where line_type='late_fee') = 1,
    'a single R150 late fee line');
  perform dev.assert((select unit_amount_cents from public.invoice_lines where line_type='late_fee') = 15000,
    'the fee is R150');
  -- Running again must not charge twice.
  perform public.apply_late_fees('2026-12-10');
  perform dev.assert((select count(*) from public.invoice_lines where line_type='late_fee') = 1,
    'running again does not charge a second time');
end $$;

do $$
declare v_fee_invoice uuid; v_target uuid;
begin
  select invoice_id, late_fee_for_invoice_id into v_fee_invoice, v_target
  from public.invoice_lines where line_type = 'late_fee';
  perform dev.assert(v_fee_invoice <> v_target,
    'the fee lands on a NEW invoice - the overdue one is never re-totalled after it was sent');
end $$;

\echo ''
\echo '=== The month reports ==='
insert into public.expenses (category_code, incurred_on, amount_cents) values
  ('rent','2026-11-05',500000), ('tutor_payments','2026-11-25',1000000);
do $$
declare v_invoiced bigint; v_collected bigint; v_surplus bigint; v_outstanding bigint;
begin
  select invoiced_cents, collected_cents into v_invoiced, v_collected
  from public.v_monthly_revenue where month = '2026-11-01';
  perform dev.assert(v_invoiced = 370000, 'November invoiced R3,700 across both families');
  perform dev.assert(v_collected = 330000, 'R3,300 collected');

  select surplus_cents into v_surplus from public.v_operating_surplus where month = '2026-11-01';
  perform dev.assert(v_surplus = 330000 - 1500000,
    'surplus is on CASH COLLECTED less expenses, so a deficit shows as one');

  select sum(outstanding_cents) into v_outstanding from public.v_outstanding_fees;
  perform dev.assert(v_outstanding > 0, 'the arrears figure is visible');
  perform dev.assert((select max_days_overdue from public.v_outstanding_fees limit 1) >= 0,
    'and shows how late it is');
end $$;

reset role;
\echo ''
\echo '=== What each parent can see ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$ begin
  perform dev.assert((select count(*) from public.invoices) = 2,
    'sees own invoices only (tuition and the late fee), not the other family');
  perform dev.assert((select count(*) from public.payments) = 1, 'sees own payment');
  perform dev.assert((select count(*) from public.v_account_statement) = 3,
    'statement shows two invoices and one payment');
end $$;

reset role;
rollback;
SQL
