#!/usr/bin/env bash
# The enrolment journey end to end: a parent submits, an admin activates,
# a term's sessions are generated, a tutor marks the register. Rolls back.
set -euo pipefail
DB="${DATABASE_URL:?DATABASE_URL not set}"

psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
set constraints all immediate;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','parent@test','{"full_name":"Thandi Mokoena"}'),
  ('cccccccc-0000-0000-0000-000000000003','tutor@test','{"full_name":"Naledi Dube"}'),
  ('dddddddd-0000-0000-0000-000000000004','admin@test','{"full_name":"Winnie Thobela"}');
insert into public.user_roles values
  ('cccccccc-0000-0000-0000-000000000003','tutor'),
  ('dddddddd-0000-0000-0000-000000000004','admin');

insert into public.tutors (id, profile_id, slug, employment_type) values
  ('44444444-0000-0000-0000-00000000000d','cccccccc-0000-0000-0000-000000000003','naledi-dube','sessional');
insert into public.tutor_competencies (id, tutor_id, subject_code, grade_code) values
  ('55555555-0000-0000-0000-00000000000e','44444444-0000-0000-0000-00000000000d','mathematics','grade_7'),
  ('55555555-0000-0000-0000-00000000000f','44444444-0000-0000-0000-00000000000d','english','grade_7');
insert into public.tutor_competency_media values
  ('55555555-0000-0000-0000-00000000000e','english'),
  ('55555555-0000-0000-0000-00000000000f','english');
insert into public.terms (id, year, term_number, starts_on, ends_on) values
  ('66666666-0000-0000-0000-00000000000f', 2026, 4, '2026-10-06', '2026-11-03');
insert into public.rooms (id, name, capacity) values ('77777777-0000-0000-0000-000000000010','Main Room',12);

\echo ''
\echo '=== PARENT submits an enrolment ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);

select public.submit_enrolment(
  '{"full_name":"Thabo Mokoena","date_of_birth":"2013-04-02","grade_code":"grade_7","school_name":"Damonsville Primary","home_language_code":"setswana","relationship":"mother"}'::jsonb,
  'group_2',
  '[{"subject_code":"mathematics","preferred_language_code":"english"},
    {"subject_code":"english","preferred_language_code":"english"}]'::jsonb,
  '[{"full_name":"Aunt Palesa","relationship":"aunt","phone":"0721234567","priority":1}]'::jsonb,
  '[{"full_name":"Aunt Palesa","relationship":"aunt","phone":"0721234567","id_number_last4":"4821"}]'::jsonb,
  (select jsonb_agg(jsonb_build_object('consent_type_code', code, 'granted', true))
     from public.consent_types where is_required),
  '1.0',
  '44444444-0000-0000-0000-00000000000d'
) as enrolment_id \gset

do $$ begin
  perform dev.assert((select count(*) from public.learners) = 1, 'learner created');
  perform dev.assert((select count(*) from public.enrolment_subjects) = 2, 'two subjects on a 2-subject package');
  perform dev.assert((select count(*) from public.learner_emergency_contacts) = 1, 'emergency contact recorded');
  perform dev.assert((select count(*) from public.authorised_collectors) = 1, 'authorised collector recorded');
  perform dev.assert((select count(*) from public.consents where granted) = 3, 'three required consents recorded');
  perform dev.assert((select status from public.enrolments) = 'pending', 'enrolment is pending, not active');
  perform dev.assert((select status from public.learners) = 'prospective', 'learner is prospective until approved');
  perform dev.assert((select preferred_tutor_id from public.enrolments) is not null, 'preferred tutor recorded');
end $$;

\echo ''
\echo '--- submission is refused without the required consents ---'
do $$ begin
  begin
    perform public.submit_enrolment(
      '{"full_name":"No Consent","date_of_birth":"2014-01-01","grade_code":"grade_7"}'::jsonb,
      'group_1', '[]'::jsonb,
      '[{"full_name":"X","relationship":"aunt","phone":"0","priority":1}]'::jsonb,
      '[]'::jsonb, '[]'::jsonb, '1.0', null);
    raise exception 'FAILED: enrolment without consent was accepted';
  exception when check_violation then
    raise notice '  PASS  rejected: submission with no POPIA consent';
  end;
  begin
    perform public.submit_enrolment(
      '{"full_name":"No Contact","date_of_birth":"2014-01-01","grade_code":"grade_7"}'::jsonb,
      'group_1', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      (select jsonb_agg(jsonb_build_object('consent_type_code', code, 'granted', true))
         from public.consent_types where is_required), '1.0', null);
    raise exception 'FAILED: enrolment without an emergency contact was accepted';
  exception when check_violation then
    raise notice '  PASS  rejected: submission with no emergency contact';
  end;
end $$;

reset role;
\echo ''
\echo '=== ADMIN activates it ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}',true);

select public.activate_enrolment(
  (select id from public.enrolments),
  '44444444-0000-0000-0000-00000000000d',
  '2026-10-18', 40000, 'Joined 18 October, part month'
) as invoice_id \gset

do $$ begin
  perform dev.assert((select status from public.enrolments) = 'active', 'enrolment is active');
  perform dev.assert((select status from public.learners) = 'active', 'learner is active');
  perform dev.assert((select count(*) from public.billing_accounts) = 1, 'billing account opened');
  perform dev.assert((select count(*) from public.invoices) = 1, 'registration invoice raised immediately');
  perform dev.assert((select total_cents from public.v_invoice_status) = 15000,
    'registration invoice is R150 only - tuition joins the 15th cycle (rule 6b)');
  perform dev.assert((select invoice_number from public.invoices) like 'SKP-2026-%', 'invoice numbered SKP-2026-NNNN');
  perform dev.assert((select first_month_amount_cents from public.enrolments) = 40000, 'first month set by admin');
  perform dev.assert((select first_month_set_by from public.enrolments) is not null, 'discretion is attributable');
end $$;

\echo ''
\echo '--- activating twice does not double-charge registration ---'
do $$ begin
  begin
    perform public.activate_enrolment((select id from public.enrolments),
      '44444444-0000-0000-0000-00000000000d', '2026-10-18', null, null);
    raise exception 'FAILED: re-activation was accepted';
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice '  PASS  rejected: activating an already-active enrolment';
  end;
  perform dev.assert((select count(*) from public.invoices) = 1, 'still exactly one invoice');
end $$;

\echo ''
\echo '=== ADMIN builds the timetable ==='
insert into public.class_groups (id, name, subject_code, language_code, tutor_id, term_id, delivery_mode, room_id, capacity)
values ('88888888-0000-0000-0000-000000000011','Grade 7 Mathematics (English)','mathematics','english',
        '44444444-0000-0000-0000-00000000000d','66666666-0000-0000-0000-00000000000f','in_centre',
        '77777777-0000-0000-0000-000000000010', 6);
insert into public.class_group_grades values ('88888888-0000-0000-0000-000000000011','grade_7');
-- Tuesday and Thursday, both inside Mon-Thu 13:00-18:00.
insert into public.class_schedules (class_group_id, day_of_week, starts_at_time, ends_at_time) values
  ('88888888-0000-0000-0000-000000000011', 2, '15:00', '16:00'),
  ('88888888-0000-0000-0000-000000000011', 4, '15:00', '16:00');

select public.generate_class_sessions('88888888-0000-0000-0000-000000000011') as generated \gset
do $$ begin
  -- 6 Oct to 3 Nov 2026 contains 5 Tuesdays and 4 Thursdays.
  perform dev.assert((select count(*) from public.class_sessions) = 9,
    'generated 9 sessions across the term (5 Tue + 4 Thu)');
  perform dev.assert((select count(*) from public.class_sessions
                      where extract(isodow from session_date) not in (2,4)) = 0,
    'every session falls on a scheduled weekday');
  perform dev.assert((select min(session_date) from public.class_sessions) >= '2026-10-06'
                 and (select max(session_date) from public.class_sessions) <= '2026-11-03',
    'sessions stay inside the term');
  perform dev.assert(
    (select to_char(starts_at at time zone 'Africa/Johannesburg', 'HH24:MI')
       from public.class_sessions order by session_date limit 1) = '15:00',
    'session time is 15:00 at the centre, stored as timestamptz');
end $$;

\echo ''
\echo '--- regenerating is idempotent ---'
select public.generate_class_sessions('88888888-0000-0000-0000-000000000011') as regenerated \gset
do $$ begin
  perform dev.assert((select count(*) from public.class_sessions) = 9, 'still 9 sessions after re-running');
end $$;

-- Place the learner.
insert into public.class_enrolments (class_group_id, learner_id, enrolment_id)
select '88888888-0000-0000-0000-000000000011', l.id, e.id
from public.learners l, public.enrolments e;

reset role;
\echo ''
\echo '=== TUTOR marks the register ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}',true);
do $$
declare v_session uuid; v_learner uuid;
begin
  select id into v_session from public.class_sessions order by session_date limit 1;
  select learner_id into v_learner from public.class_enrolments limit 1;
  perform dev.assert(v_session is not null, 'tutor can see the generated sessions');
  perform dev.assert(v_learner is not null, 'tutor can see the placed learner');

  insert into public.attendance_records (class_session_id, learner_id, status, marked_by)
  values (v_session, v_learner, 'present', 'cccccccc-0000-0000-0000-000000000003');
  perform dev.assert((select count(*) from public.attendance_records) = 1, 'register marked');

  perform dev.assert((select count(*) from public.invoices) = 0, 'tutor still cannot see billing');
end $$;

reset role;
\echo ''
\echo '=== PARENT sees the timetable ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ begin
  perform dev.assert((select count(*) from public.class_sessions) = 9, 'parent sees their child timetable');
  perform dev.assert((select count(*) from public.attendance_records) = 1, 'parent sees the attendance mark');
  perform dev.assert((select count(*) from public.invoices) = 1, 'parent sees the registration invoice');
end $$;

reset role;
rollback;
SQL
