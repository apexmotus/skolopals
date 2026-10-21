#!/usr/bin/env bash
# End-to-end billing and assessment cycle. Reproduces the worked example in
# SPEC section 9.3 and asserts the actual figures. Rolls back.
set -euo pipefail
DB="${DATABASE_URL:?DATABASE_URL not set}"

psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
set constraints all immediate;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','g@test','{"full_name":"Guardian"}'),
  ('cccccccc-0000-0000-0000-000000000003','t@test','{"full_name":"Tutor"}');
insert into public.user_roles values ('cccccccc-0000-0000-0000-000000000003','tutor');
insert into public.tutors (id, profile_id, slug, employment_type) values
  ('44444444-0000-0000-0000-00000000000d','cccccccc-0000-0000-0000-000000000003','t','sessional');
insert into public.learners (id, full_name, date_of_birth, grade_code, status) values
  ('11111111-0000-0000-0000-00000000000a','Thabo','2013-04-02','grade_7','active'),
  ('22222222-0000-0000-0000-00000000000b','Lerato','2015-04-02','grade_5','active');
insert into public.learner_guardians (learner_id, guardian_id, relationship, is_billing_contact) values
  ('11111111-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','mother',true),
  ('22222222-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','mother',true);
insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
select ct.code,'aaaaaaaa-0000-0000-0000-000000000001', l.id, true,'1.0'
from public.consent_types ct cross join public.learners l where ct.is_required;
insert into public.enrolments (id, learner_id, package_code, status, start_date,
                               first_month_amount_cents, first_month_set_by, first_month_reason)
values ('aaaa1111-0000-0000-0000-000000000013','11111111-0000-0000-0000-00000000000a',
        'group_2','active','2026-10-18', 40000, 'aaaaaaaa-0000-0000-0000-000000000001',
        'Joined 18 October, part month at admin discretion');
insert into public.billing_accounts (id, guardian_id) values
  ('bbbb2222-0000-0000-0000-000000000014','aaaaaaaa-0000-0000-0000-000000000001');

\echo ''
\echo '=== Invoice numbering (SKP-YYYY-NNNN, yearly reset) ==='
do $$
declare a text; b text; c text;
begin
  a := private.next_invoice_number(date '2026-10-18');
  b := private.next_invoice_number(date '2026-11-15');
  c := private.next_invoice_number(date '2027-01-15');
  perform dev.assert(a = 'SKP-2026-0001', 'first 2026 invoice is SKP-2026-0001');
  perform dev.assert(b = 'SKP-2026-0002', 'second 2026 invoice increments');
  perform dev.assert(c = 'SKP-2027-0001', 'sequence RESETS in 2027');
end $$;

\echo ''
\echo '=== SPEC 9.3: learner joins 18 Oct, after the 15th run ==='
-- On activation: registration only, due on issue.
insert into public.invoices (id, billing_account_id, invoice_number, issued_on, due_on, status) values
  ('1111aaaa-0000-0000-0000-000000000101','bbbb2222-0000-0000-0000-000000000014',
   'SKP-2026-0042','2026-10-18','2026-10-18','issued');
insert into public.invoice_lines (invoice_id, line_type, description, package_code, learner_id, unit_amount_cents) values
  ('1111aaaa-0000-0000-0000-000000000101','registration','Registration fee','registration',
   '11111111-0000-0000-0000-00000000000a', public.package_price_on('registration','2026-10-18'));
do $$ begin
  perform dev.assert((select total_cents from public.v_invoice_status
                      where id='1111aaaa-0000-0000-0000-000000000101') = 15000,
    'activation invoice is R150 registration only');
end $$;

-- 15 Nov run: catches up October part-month and November, plus December.
insert into public.invoices (id, billing_account_id, invoice_number, period_start, period_end, issued_on, due_on, status) values
  ('2222aaaa-0000-0000-0000-000000000102','bbbb2222-0000-0000-0000-000000000014',
   'SKP-2026-0051','2026-10-18','2026-12-31','2026-11-15','2026-12-01','issued');
insert into public.invoice_lines (invoice_id, line_type, description, enrolment_id, learner_id, period_month, unit_amount_cents) values
  ('2222aaaa-0000-0000-0000-000000000102','package','October part month (18-31)','aaaa1111-0000-0000-0000-000000000013','11111111-0000-0000-0000-00000000000a','2026-10-01', 40000),
  ('2222aaaa-0000-0000-0000-000000000102','package','November tuition',          'aaaa1111-0000-0000-0000-000000000013','11111111-0000-0000-0000-00000000000a','2026-11-01', 75000),
  ('2222aaaa-0000-0000-0000-000000000102','package','December tuition',          'aaaa1111-0000-0000-0000-000000000013','11111111-0000-0000-0000-00000000000a','2026-12-01', 75000);
do $$ begin
  perform dev.assert((select total_cents from public.v_invoice_status
                      where id='2222aaaa-0000-0000-0000-000000000102') = 190000,
    'catch-up invoice is R1,900 exactly as SPEC 9.3 predicts');
  perform dev.assert((select payment_state from public.v_invoice_status
                      where id='2222aaaa-0000-0000-0000-000000000102') = 'unpaid',
    'unpaid before the due date');
end $$;

\echo ''
\echo '=== Late fee: 3 days grace after the 1 Dec due date ==='
do $$ begin
  perform dev.assert(not public.invoice_late_fee_due('2222aaaa-0000-0000-0000-000000000102','2026-12-01'),
    'no fee on the due date');
  perform dev.assert(not public.invoice_late_fee_due('2222aaaa-0000-0000-0000-000000000102','2026-12-04'),
    'no fee on day 3 of grace');
  perform dev.assert(public.invoice_late_fee_due('2222aaaa-0000-0000-0000-000000000102','2026-12-05'),
    'fee IS due on day 4');
  perform dev.assert((select payment_state from public.v_invoice_status
                      where id='2222aaaa-0000-0000-0000-000000000102') = 'overdue'
                     or current_date < date '2026-12-02',
    'becomes overdue once past due');
end $$;

\echo ''
\echo '=== AC-08: one payment settling three invoices, two children ==='
-- A third invoice, for the second child.
insert into public.invoices (id, billing_account_id, invoice_number, issued_on, due_on, status) values
  ('3333aaaa-0000-0000-0000-000000000103','bbbb2222-0000-0000-0000-000000000014',
   'SKP-2026-0052','2026-11-15','2026-12-01','issued');
insert into public.invoice_lines (invoice_id, line_type, description, learner_id, period_month, unit_amount_cents) values
  ('3333aaaa-0000-0000-0000-000000000103','package','November tuition','22222222-0000-0000-0000-00000000000b','2026-11-01', 45000);

insert into public.payments (id, billing_account_id, paid_on, amount_cents, method, reference) values
  ('4444aaaa-0000-0000-0000-000000000104','bbbb2222-0000-0000-0000-000000000014',
   '2026-12-02', 250000, 'eft', 'EFT-99812');
insert into public.payment_allocations (payment_id, invoice_id, amount_cents) values
  ('4444aaaa-0000-0000-0000-000000000104','1111aaaa-0000-0000-0000-000000000101',  15000),
  ('4444aaaa-0000-0000-0000-000000000104','2222aaaa-0000-0000-0000-000000000102', 190000),
  ('4444aaaa-0000-0000-0000-000000000104','3333aaaa-0000-0000-0000-000000000103',  45000);
do $$ begin
  perform dev.assert((select count(*) from public.v_invoice_status
                      where billing_account_id='bbbb2222-0000-0000-0000-000000000014'
                        and payment_state='paid') = 3,
    'ONE R2,500 payment settles all THREE invoices across two children');
  perform dev.assert((select sum(balance_cents) from public.v_invoice_status
                      where billing_account_id='bbbb2222-0000-0000-0000-000000000014') = 0,
    'account balance is zero');
end $$;

\echo ''
\echo '=== Allocation guards ==='
create or replace function pg_temp.rejects(p_sql text, p_what text)
returns void language plpgsql as $fn$
begin
  begin execute p_sql;
  exception when check_violation or unique_violation then
    raise notice '  PASS  rejected: %', p_what; return;
  end;
  raise exception 'FAILED: % was ACCEPTED', p_what;
end; $fn$;

insert into public.payments (id, billing_account_id, paid_on, amount_cents, method) values
  ('5555aaaa-0000-0000-0000-000000000105','bbbb2222-0000-0000-0000-000000000014','2026-12-03', 10000,'cash');
insert into public.invoices (id, billing_account_id, invoice_number, issued_on, due_on, status) values
  ('6666aaaa-0000-0000-0000-000000000106','bbbb2222-0000-0000-0000-000000000014',
   'SKP-2026-0053','2026-12-01','2027-01-01','issued');
insert into public.invoice_lines (invoice_id, line_type, description, period_month, unit_amount_cents) values
  ('6666aaaa-0000-0000-0000-000000000106','package','January tuition','2027-01-01', 75000);

select pg_temp.rejects($$
  insert into public.payment_allocations values
    ('5555aaaa-0000-0000-0000-000000000105','6666aaaa-0000-0000-0000-000000000106', 20000);
$$, 'allocating R200 from a R100 payment');
select pg_temp.rejects($$
  insert into public.payments (id, billing_account_id, paid_on, amount_cents, method) values
    ('7777aaaa-0000-0000-0000-000000000107','bbbb2222-0000-0000-0000-000000000014','2026-12-03',200000,'eft');
  insert into public.payment_allocations values
    ('7777aaaa-0000-0000-0000-000000000107','6666aaaa-0000-0000-0000-000000000106', 100000);
$$, 'settling R1,000 against a R750 invoice');

\echo ''
\echo '=== Assessment chain (BP section 12) ==='
insert into public.terms (id, year, term_number, starts_on, ends_on) values
  ('66666666-0000-0000-0000-00000000000f',2026,4,'2026-10-06','2026-12-09');
insert into public.assessments (id, learner_id, assessment_type_code, grade_code, term_id, administered_by, assessed_on) values
  ('8888aaaa-0000-0000-0000-000000000108','11111111-0000-0000-0000-00000000000a','initial','grade_7',
   '66666666-0000-0000-0000-00000000000f','44444444-0000-0000-0000-00000000000d','2026-10-19');
insert into public.assessment_scores (assessment_id, domain_code, raw_score, max_score, achievement_level_code) values
  ('8888aaaa-0000-0000-0000-000000000108','reading',       22, 50, 3),
  ('8888aaaa-0000-0000-0000-000000000108','spelling',      18, 40, 3),
  ('8888aaaa-0000-0000-0000-000000000108','comprehension', 15, 50, 2),
  ('8888aaaa-0000-0000-0000-000000000108','writing',       20, 40, 4),
  ('8888aaaa-0000-0000-0000-000000000108','mathematics',   28, 50, 4),
  ('8888aaaa-0000-0000-0000-000000000108','language',      24, 50, 3);
do $$ begin
  perform dev.assert((select count(*) from public.assessment_scores
                      where assessment_id='8888aaaa-0000-0000-0000-000000000108') = 6,
    'initial assessment records all six domains separately');
  perform dev.assert((select percent from public.assessment_scores
                      where assessment_id='8888aaaa-0000-0000-0000-000000000108'
                        and domain_code='comprehension') = 30.00,
    'percent is derived per domain (15/50 = 30%)');
end $$;

insert into public.learning_plans (id, learner_id, from_assessment_id, term_id, status, activated_at) values
  ('9999aaaa-0000-0000-0000-000000000109','11111111-0000-0000-0000-00000000000a',
   '8888aaaa-0000-0000-0000-000000000108','66666666-0000-0000-0000-00000000000f','active', now());
insert into public.learning_plan_goals (learning_plan_id, subject_code, goal, target_level_code, target_date) values
  ('9999aaaa-0000-0000-0000-000000000109','english','Raise comprehension to grade level',4,'2026-12-09'),
  ('9999aaaa-0000-0000-0000-000000000109','mathematics','Secure fractions and ratios',5,'2026-12-09');
do $$ begin
  perform dev.assert((select count(*) from public.learning_plan_goals) = 2,
    'learning plan carries per-subject goals');
end $$;
select pg_temp.rejects($$
  insert into public.learning_plans (learner_id, status, activated_at)
  values ('11111111-0000-0000-0000-00000000000a','active', now());
$$, 'a second ACTIVE learning plan for one learner');

insert into public.progress_reports (id, learner_id, term_id, tutor_id, summary) values
  ('aaaabbbb-0000-0000-0000-00000000010a','11111111-0000-0000-0000-00000000000a',
   '66666666-0000-0000-0000-00000000000f','44444444-0000-0000-0000-00000000000d','Steady progress.');
select pg_temp.rejects($$
  update public.progress_reports set published_at = now()
  where id = 'aaaabbbb-0000-0000-0000-00000000010a';
$$, 'publishing a report with no subject detail');
select pg_temp.rejects($$
  insert into public.report_acknowledgements (progress_report_id, guardian_id)
  values ('aaaabbbb-0000-0000-0000-00000000010a','aaaaaaaa-0000-0000-0000-000000000001');
$$, 'acknowledging an UNPUBLISHED report');

insert into public.progress_report_subjects (progress_report_id, subject_code, achievement_level_code, strengths, areas_for_improvement, recommended_intervention) values
  ('aaaabbbb-0000-0000-0000-00000000010a','english',4,'Reading fluency improved','Comprehension','Weekly guided reading'),
  ('aaaabbbb-0000-0000-0000-00000000010a','mathematics',4,'Confident with operations','Fractions','Targeted fractions worksheets');
update public.progress_reports set published_at = now()
  where id = 'aaaabbbb-0000-0000-0000-00000000010a';
insert into public.report_acknowledgements (progress_report_id, guardian_id, comment) values
  ('aaaabbbb-0000-0000-0000-00000000010a','aaaaaaaa-0000-0000-0000-000000000001','Thank you, we will practise at home.');
do $$ begin
  perform dev.assert((select issued_on is not null from public.progress_reports
                      where id='aaaabbbb-0000-0000-0000-00000000010a'),
    'publishing sets issued_on automatically');
  perform dev.assert((select count(*) from public.report_acknowledgements) = 1,
    'parent feedback closes the value chain (BP section 10)');
end $$;

\echo ''
\echo '=== KPI views on real data ==='
insert into public.expenses (category_code, incurred_on, amount_cents) values
  ('rent','2026-11-05',500000), ('tutor_payments','2026-11-25',1000000);
do $$
declare v_surplus bigint; v_rev bigint;
begin
  select surplus_cents into v_surplus from public.v_operating_surplus where month = '2026-11-01';
  perform dev.assert(v_surplus is not null, 'operating surplus computes for November');
  select invoiced_cents into v_rev from public.v_monthly_revenue where month = '2026-11-01';
  perform dev.assert(v_rev = 235000, 'November invoiced R2,350 (R1,900 + R450)');
  perform dev.assert((select count(*) from public.v_assessment_improvement) = 6,
    'assessment improvement tracks all six domains');
  perform dev.assert((select count(*) from public.v_outstanding_fees) >= 0,
    'outstanding fees view runs');
end $$;

rollback;
SQL
