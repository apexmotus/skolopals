#!/usr/bin/env bash
# One-off repair for UAT, the same as was done on dev on 2026-11-26.
#
# An early draft of 20261126000001_tutor_applications was applied to UAT by
# hand and never recorded: it has no withdrawn_at column, no retention view and
# no purge_tutor_application, so Admin → Tutor applications fails with
# "relation public.v_tutor_application_retention_due does not exist".
# Migrations 20261125000004–000011 may also be on UAT but unrecorded, which
# would make migrate.sh try to apply them again.
#
# In one transaction this script:
#   1. records each of 20261125000004–000011 that is on the database but not in
#      public.schema_migrations (checked object by object);
#   2. if the tutor-applications draft is there, removes it (only when it holds
#      no rounds and no applications) and applies the final migration file;
#   3. records 20261126000001_tutor_applications.
# Then run `make migrate` as usual for anything still missing.
#
# Usage: ./scripts/repair-uat-ledger.sh "postgresql://...dhmjzshlznhqohvkdcpz...:5432/postgres"
set -euo pipefail

DB="${1:?Pass the UAT connection string}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$DB" != *dhmjzshlznhqohvkdcpz* ]]; then
  echo "Refusing: this is a UAT-only repair and the URL does not contain the UAT project ref." >&2
  exit 1
fi

echo "Before:"
psql "$DB" -X -At -c "select '  ledger rows: ' || count(*) || ', latest: ' || coalesce(max(version), '-') from public.schema_migrations"

draft=$(psql "$DB" -X -At -c "
  select case
    when to_regclass('public.tutor_applications') is null then 'absent'
    when exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'tutor_applications' and column_name = 'withdrawn_at')
         and to_regclass('public.v_tutor_application_retention_due') is not null then 'final'
    else 'draft' end")
echo "  tutor applications: $draft"

if [[ "$draft" == "draft" ]]; then
  rows=$(psql "$DB" -X -At -c "select (select count(*) from public.tutor_applications) + (select count(*) from public.tutor_recruitment_rounds)")
  if [[ "$rows" != "0" ]]; then
    echo "Refusing: the draft holds $rows round(s)/application(s). Bring it up to date by hand instead." >&2
    exit 1
  fi
fi

{
  cat <<'SQL'
begin;

-- 1. Record earlier migrations whose objects are already here.
insert into public.schema_migrations (version)
select v from (values
  ('20261125000004_thread_people',
     to_regprocedure('public.thread_people(uuid)') is not null),
  ('20261125000005_centre_staff_ids',
     to_regprocedure('public.centre_staff_ids()') is not null),
  ('20261125000006_learner_counts',
     to_regclass('public.v_learner_counts') is not null and to_regclass('public.v_learner_retention') is not null),
  ('20261125000007_retire_health_consent',
     exists (select 1 from information_schema.columns where table_schema = 'public'
              and table_name = 'consent_types' and column_name = 'is_active')),
  ('20261125000008_substitute_access',
     coalesce(pg_get_functiondef(to_regprocedure('private.tutor_teaches(uuid)')) like '%current_date - 14%', false)),
  ('20261125000009_retention_wording',
     exists (select 1 from public.data_retention_policies where record_class = 'learner_records'
              and description = 'Learner identity, academic records, reports, attendance and authorised collectors')),
  ('20261125000010_door_and_online_attendance',
     (select count(*) from pg_trigger where tgname in ('learners_stamp_leave_alone', 'check_in_departure')) = 2),
  ('20261125000011_late_pickup_schedule',
     to_regclass('cron.job') is not null)
) as m(v, present)
where present
on conflict (version) do nothing;
SQL
  if [[ "$draft" != "final" ]]; then
    cat <<'SQL'

-- 2. Remove the unrecorded draft (empty, checked above).
drop trigger if exists tutors_guard_self_update on public.tutors;
drop view if exists public.v_tutor_application_retention_due;
drop table if exists public.tutor_application_references, public.tutor_application_documents,
  public.tutor_application_competency_media, public.tutor_application_competencies,
  public.tutor_applications, public.tutor_recruitment_needs, public.tutor_recruitment_rounds cascade;
alter table public.tutors drop column if exists application_id,
  drop column if exists police_clearance_requested_at, drop column if exists police_clearance_request_note;
do $teardown$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'private') and p.proname = any (array[
             'add_police_clearance', 'approve_tutor_application', 'close_expired_recruitment', 'close_tutor_recruitment',
             'guard_tutor_self_update', 'list_tutor_applications', 'make_tutor', 'mark_tutor_application_identity_checked',
             'open_recruitment_round', 'open_tutor_recruitment', 'request_police_clearance', 'set_recruitment_needs',
             'set_tutor_application_status', 'submit_tutor_application', 'tutor_recruitment_status',
             'update_tutor_recruitment', 'withdraw_tutor_application', 'purge_tutor_application'])
  loop execute 'drop function ' || r.sig; end loop;
end
$teardown$;

SQL
    cat "$DIR/migrations/20261126000001_tutor_applications.sql"
  fi
  cat <<'SQL'

-- 3. Record the tutor applications migration.
insert into public.schema_migrations (version) values ('20261126000001_tutor_applications')
on conflict (version) do nothing;

commit;
SQL
} | psql "$DB" -X -v ON_ERROR_STOP=1 -q

echo "After:"
psql "$DB" -X -At -c "select '  ledger rows: ' || count(*) || ', latest: ' || max(version) from public.schema_migrations"
echo "Now run: make migrate DATABASE_URL=\"\$same_url\"  (applies anything still unrecorded)"
