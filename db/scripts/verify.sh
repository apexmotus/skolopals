#!/usr/bin/env bash
# Structural assertions. Fails loudly rather than reporting a tidy summary of
# a broken database. Grows with each phase.
set -euo pipefail

DB="${DATABASE_URL:?DATABASE_URL not set}"
fails=0

check() { # check <description> <sql returning boolean>
  local desc="$1" sql="$2" result
  result=$(psql "$DB" -tAc "$sql" 2>&1 | tr -d '[:space:]')
  if [ "$result" = "t" ]; then
    printf '  \033[32mPASS\033[0m  %s\n' "$desc"
  else
    printf '  \033[31mFAIL\033[0m  %s  (got: %s)\n' "$desc" "$result"
    fails=$((fails + 1))
  fi
}

echo "Structure"
check "all reference tables exist" "
  select count(*) = 9 from information_schema.tables
  where table_schema = 'public' and table_name in
   ('school_phases','grades','subjects','subject_offerings','languages',
    'achievement_levels','terms','centre_operating_hours','rooms')"

echo
echo "4NF guard"
# The whole point of the rebuild: no multivalued attribute may hide in a column.
check "no array-typed columns in public" "
  select count(*) = 0 from information_schema.columns
  where table_schema = 'public' and data_type = 'ARRAY'"
check "every public table has a primary key" "
  select count(*) = 0 from information_schema.tables t
  where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    and not exists (
      select 1 from information_schema.table_constraints c
      where c.table_schema = t.table_schema and c.table_name = t.table_name
        and c.constraint_type = 'PRIMARY KEY')"

echo
echo "Row level security"
check "RLS enabled on every public table" "
  select count(*) = 0 from pg_tables p
  join pg_class c on c.relname = p.tablename
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = p.schemaname
  where p.schemaname = 'public' and c.relrowsecurity = false"
# information_schema.role_table_grants shows only DIRECT grants, so it misses
# privileges inherited via role membership and reports a false pass.
# has_table_privilege() is the authoritative, inheritance-aware answer.
# NOTE: pass the OID, never format('public.%I', name). The planner may
# evaluate has_table_privilege() before the schema filter, and a bare name is
# then resolved against search_path - which silently hits storage.buckets.
check "anon inserts ONLY contact_enquiries" "
  select count(*) = 0 from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname <> 'contact_enquiries'
    and has_table_privilege('anon', c.oid, 'INSERT')"
check "anon can never update or delete" "
  select count(*) = 0 from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE'))"
# Parents must write enrolments and tutors must mark registers, so a blanket
# ban no longer holds. Instead: authenticated may write ONLY these tables, and
# anything it can write must be gated by RLS.
# The real invariant is not "authenticated cannot write table X" - RLS is the
# control, and a grant without a policy simply fails. It is the reverse: a
# table that authenticated can write MUST have a policy restricting the write,
# otherwise the grant is unguarded.
check "every table authenticated can INSERT has a WITH CHECK policy" "
  select count(*) = 0 from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege('authenticated', c.oid, 'INSERT')
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname
        and p.cmd in ('INSERT','ALL') and p.with_check is not null)"
check "every table authenticated can UPDATE has a policy" "
  select count(*) = 0 from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege('authenticated', c.oid, 'UPDATE')
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname
        and p.cmd in ('UPDATE','ALL'))"
check "records with retention or audit value are not deletable" "
  select count(*) = 0 from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname in ('learners','enrolments','invoices','payments','consents',
                      'attendance_records','assessments','progress_reports',
                      'data_retention_log')
    and has_table_privilege('authenticated', c.oid, 'DELETE')"
# A test role that inherits from a superuser silently defeats every RLS policy,
# so local RLS testing would pass no matter how broken the policies are.
check "no Supabase role inherits from a superuser" "
  select count(*) = 0
  from pg_auth_members am
  join pg_roles member on member.oid = am.member
  join pg_roles granted on granted.oid = am.roleid
  where member.rolname in ('anon','authenticated','service_role')
    and granted.rolsuper"
check "no Supabase role is itself a superuser or bypasses RLS" "
  select count(*) = 0 from pg_roles
  where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)"
# A view defaults to security_invoker=false, which runs it as the OWNER and
# BYPASSES RLS on its base tables. v_public_timetable relies on that on
# purpose; every other view must set security_invoker=true or it silently
# leaks whatever it selects from.
check "every view except v_public_timetable is security_invoker" "
  select count(*) = 0 from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and c.relname <> 'v_public_timetable'
    and not coalesce('security_invoker=true' = any(c.reloptions), false)"
check "v_public_timetable exposes no meeting_url" "
  select count(*) = 0 from information_schema.columns
  where table_schema='public' and table_name='v_public_timetable'
    and column_name = 'meeting_url'"
check "every table authenticated can write has at least one policy" "
  select count(*) = 0 from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege('authenticated', c.oid, 'INSERT')
    and not exists (select 1 from pg_policies p
                    where p.schemaname='public' and p.tablename = c.relname)"

echo
echo "POPIA"
check "sensitive tables are not readable by anon" "
  select count(*) = 0 from pg_policies
  where schemaname = 'public'
    and tablename in ('learner_medical_notes','tutor_documents','tutor_references',
                      'consents','data_retention_log','billing_settings')
    and 'anon' = any(roles)"
check "medical notes carry no tutor-visible policy" "
  select count(*) = 0 from pg_policies
  where schemaname='public' and tablename='learner_medical_notes'
    and qual like '%tutor%'"
check "three required consent types" "
  select count(*) = 3 from public.consent_types where is_required"
check "optional consents exist and are not required" "
  select count(*) = 2 from public.consent_types where not is_required"
check "retention policies cover learner and financial records" "
  select count(*) = 2 from public.data_retention_policies
  where record_class in ('learner_records','financial_records')
    and retention_months = 60"

echo
echo "Packages (BP section 9)"
check "10 packages seeded" "select count(*) = 10 from public.packages"
check "group tiers priced 450/750/950" "
  select count(*) = 3 from public.packages p
  where p.code in ('group_1','group_2','group_3')
    and public.package_price_on(p.code, date '2026-06-01') in (45000, 75000, 95000)"
check "registration fee is R150" "
  select public.package_price_on('registration', date '2026-06-01') = 15000"
check "one-on-one hour is R180" "
  select public.package_price_on('one_on_one_hr', date '2026-06-01') = 18000"
check "billing: issue 15th, due 1st, 3 days grace, R150 late fee" "
  select count(*) = 1 from public.billing_settings
  where issue_day = 15 and due_day = 1 and grace_days = 3 and late_fee_cents = 15000"
check "no package has overlapping prices" "
  select count(*) = 0 from public.package_prices a join public.package_prices b
    on a.package_code = b.package_code and a.id <> b.id
   and daterange(a.effective_from, a.effective_to, '[)')
    && daterange(b.effective_from, b.effective_to, '[)')"

echo
echo "Billing (SPEC section 9)"
# NOTE: next_invoice_number() CONSUMES a number, so it is never called here.
# verify.sh must be read-only; its behaviour is asserted in test-billing.sh,
# which runs inside a rolled-back transaction.
check "invoice numbering function exists" "
  select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'next_invoice_number'"
check "verify has consumed no invoice numbers" "
  select count(*) = 0 from public.invoice_sequences"
check "invoice payment state is DERIVED, not stored" "
  select count(*) = 0 from information_schema.columns
  where table_schema='public' and table_name='invoices' and column_name='payment_state'"
check "payment allocation is many-to-many" "
  select count(*) = 2 from information_schema.key_column_usage
  where table_schema='public' and table_name='payment_allocations'
    and constraint_name like '%pkey%'"
check "tutors have no billing policy anywhere" "
  select count(*) = 0 from pg_policies
  where schemaname='public'
    and tablename in ('invoices','invoice_lines','payments','payment_allocations',
                      'billing_accounts','credit_notes','billing_settings')
    and (qual like '%tutor%' or with_check like '%tutor%')"
check "billing tables are not readable by anon" "
  select count(*) = 0 from pg_policies
  where schemaname='public'
    and tablename in ('invoices','invoice_lines','payments','billing_accounts')
    and 'anon' = any(roles)"

echo
echo "Derived data is not duplicated (DR-06)"
check "tutors has no stored rating or review_count" "
  select count(*) = 0 from information_schema.columns
  where table_schema='public' and table_name='tutors'
    and column_name in ('rating','review_count')"
check "tutor_rating_summary view exists" "
  select count(*) = 1 from information_schema.views
  where table_schema='public' and table_name='tutor_rating_summary'"
check "all KPI views present" "
  select count(*) = 12 from information_schema.views
  where table_schema='public' and table_name in
   ('v_monthly_revenue','v_monthly_expenses','v_operating_surplus',
    'v_outstanding_fees','v_revenue_per_learner','v_attendance',
    'v_attendance_rate','v_assessment_improvement','v_learner_counts',
    'v_learner_retention','v_enquiry_funnel','v_tutor_session_load')"
check "every KPI view is queryable" "
  select (select count(*) >= 0 from public.v_operating_surplus)
     and (select count(*) >= 0 from public.v_outstanding_fees)
     and (select count(*) >= 0 from public.v_attendance_rate)
     and (select count(*) >= 0 from public.v_assessment_improvement)
     and (select count(*) >= 0 from public.v_learner_retention)
     and (select count(*) >= 0 from public.v_enquiry_funnel)
     and (select count(*) >= 0 from public.v_break_even)
     and (select count(*) >= 0 from public.v_account_statement)"

echo
echo "Curriculum integrity"
check "13 grades seeded (R + 1-12)" "select count(*) = 13 from public.grades"
check "every grade belongs to a real phase" "
  select count(*) = 0 from public.grades g
  left join public.school_phases p on p.code = g.phase_code where p.code is null"
check "4 CAPS phases" "select count(*) = 4 from public.school_phases"
check "7 achievement levels" "select count(*) = 7 from public.achievement_levels"
check "achievement bands tile 0-100 with no gaps" "
  select sum(max_percent - min_percent + 1) = 101 from public.achievement_levels"
check "every offering points at a real subject and grade" "
  select count(*) = 0 from public.subject_offerings o
  where not exists (select 1 from public.subjects s where s.code = o.subject_code)
     or not exists (select 1 from public.grades  g where g.code = o.grade_code)"
check "every grade has at least one subject offered" "
  select count(*) = 0 from public.grades g
  where not exists (select 1 from public.subject_offerings o where o.grade_code = g.code)"
check "every subject is offered at some grade" "
  select count(*) = 0 from public.subjects s
  where not exists (select 1 from public.subject_offerings o where o.subject_code = s.code)"
check "FET-only subjects not offered below Grade 10" "
  select count(*) = 0 from public.subject_offerings o
  join public.grades g on g.code = o.grade_code
  where o.subject_code in ('accounting','business_studies','economics',
                           'life_sciences','physical_sciences','mathematical_literacy')
    and g.sort_order < 10"

echo
echo "Operating hours (BP section 11)"
check "Mon-Thu tutoring 13:00-18:00" "
  select count(*) = 4 from public.centre_operating_hours
  where day_of_week between 1 and 4
    and opens_at = '13:00' and closes_at = '18:00' and purpose = 'tutoring'"
check "Saturday tutoring 08:00-13:00" "
  select count(*) = 1 from public.centre_operating_hours
  where day_of_week = 6 and opens_at = '08:00' and closes_at = '13:00'"
check "centre closed on Sunday" "
  select count(*) = 0 from public.centre_operating_hours where day_of_week = 7"

echo
echo "Admin-entered, deliberately unseeded (BRS D-01)"
check "terms table is empty" "select count(*) = 0 from public.terms"
check "rooms table is empty" "select count(*) = 0 from public.rooms"

echo
if [ "$fails" -gt 0 ]; then
  printf '\033[31m%d check(s) failed\033[0m\n' "$fails"
  exit 1
fi
printf '\033[32mAll checks passed\033[0m\n'
