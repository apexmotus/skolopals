#!/usr/bin/env bash
# Business-rule triggers: the constraints that encode the design decisions.
# Each case asserts the database REJECTS something it should reject.
# Runs in one transaction and rolls back.
set -euo pipefail
DB="${DATABASE_URL:?DATABASE_URL not set}"

psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
-- Deferred constraint triggers would otherwise only fire at COMMIT, which a
-- rolled-back test transaction never reaches.
set constraints all immediate;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','g@test','{"full_name":"G"}'),
  ('cccccccc-0000-0000-0000-000000000003','t@test','{"full_name":"T"}');
insert into public.user_roles (user_id, role) values ('cccccccc-0000-0000-0000-000000000003','tutor');
insert into public.tutors (id, profile_id, slug, employment_type) values
  ('44444444-0000-0000-0000-00000000000d','cccccccc-0000-0000-0000-000000000003','t','sessional');
-- Teaches Mathematics at Grade 7, in ENGLISH ONLY.
insert into public.tutor_competencies (id, tutor_id, subject_code, grade_code) values
  ('55555555-0000-0000-0000-00000000000e','44444444-0000-0000-0000-00000000000d','mathematics','grade_7');
insert into public.tutor_competency_media (competency_id, language_code) values
  ('55555555-0000-0000-0000-00000000000e','english');
insert into public.terms (id, year, term_number, starts_on, ends_on) values
  ('66666666-0000-0000-0000-00000000000f',2026,4,'2026-10-06','2026-12-09');
insert into public.rooms (id,name,capacity) values ('77777777-0000-0000-0000-000000000010','R1',2);
insert into public.learners (id, full_name, date_of_birth, grade_code, status) values
  ('11111111-0000-0000-0000-00000000000a','L A','2013-04-02','grade_7','prospective'),
  ('22222222-0000-0000-0000-00000000000b','L B','2013-05-02','grade_7','prospective'),
  ('33333333-0000-0000-0000-00000000000c','L C','2013-06-02','grade_7','prospective');
insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact) values
  ('11111111-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','mother',true,true);

create or replace function pg_temp.rejects(p_sql text, p_what text)
returns void language plpgsql as $fn$
begin
  begin
    execute p_sql;
  exception
    when check_violation or foreign_key_violation or unique_violation
      or exclusion_violation or not_null_violation then
      raise notice '  PASS  rejected: %', p_what;
      return;
  end;
  raise exception 'FAILED: % was ACCEPTED but should have been rejected', p_what;
end;
$fn$;

\echo ''
\echo '=== Teaching competency (the subject x grade x medium decision) ==='
do $$ begin
  -- Correct: Maths, Grade 7, English.
  insert into public.class_groups (id,name,subject_code,language_code,tutor_id,term_id,delivery_mode,room_id,capacity)
  values ('88888888-0000-0000-0000-000000000011','OK','mathematics','english',
          '44444444-0000-0000-0000-00000000000d','66666666-0000-0000-0000-00000000000f','in_centre',
          '77777777-0000-0000-0000-000000000010',2);
  insert into public.class_group_grades values ('88888888-0000-0000-0000-000000000011','grade_7');
  perform dev.assert(true, 'accepted: Maths / Grade 7 / English - tutor is competent');
end $$;

select pg_temp.rejects($$
  insert into public.class_groups (id,name,subject_code,language_code,tutor_id,term_id,delivery_mode,room_id,capacity)
  values ('88888888-0000-0000-0000-000000000021','Bad','mathematics','afrikaans',
          '44444444-0000-0000-0000-00000000000d','66666666-0000-0000-0000-00000000000f','in_centre',
          '77777777-0000-0000-0000-000000000010',2);
  insert into public.class_group_grades values ('88888888-0000-0000-0000-000000000021','grade_7');
$$, 'Maths / Grade 7 / AFRIKAANS - tutor only teaches it in English');

select pg_temp.rejects($$
  insert into public.class_groups (id,name,subject_code,language_code,tutor_id,term_id,delivery_mode,room_id,capacity)
  values ('88888888-0000-0000-0000-000000000022','Bad','mathematics','english',
          '44444444-0000-0000-0000-00000000000d','66666666-0000-0000-0000-00000000000f','in_centre',
          '77777777-0000-0000-0000-000000000010',2);
  insert into public.class_group_grades values ('88888888-0000-0000-0000-000000000022','grade_9');
$$, 'Maths / GRADE 9 / English - tutor is only competent at Grade 7');

select pg_temp.rejects($$
  insert into public.tutor_competencies (tutor_id, subject_code, grade_code)
  values ('44444444-0000-0000-0000-00000000000d','accounting','grade_4');
$$, 'competency in Accounting at Grade 4 - the centre does not offer it there');

\echo ''
\echo '=== Centre operating hours (BP section 11) ==='
select pg_temp.rejects($$
  insert into public.class_schedules (class_group_id, day_of_week, starts_at_time, ends_at_time)
  values ('88888888-0000-0000-0000-000000000011', 2, '09:00', '10:00');
$$, 'Tuesday 09:00 - the centre opens at 13:00');
select pg_temp.rejects($$
  insert into public.class_schedules (class_group_id, day_of_week, starts_at_time, ends_at_time)
  values ('88888888-0000-0000-0000-000000000011', 7, '14:00', '15:00');
$$, 'Sunday - the centre is closed');
do $$ begin
  insert into public.class_schedules (class_group_id, day_of_week, starts_at_time, ends_at_time)
  values ('88888888-0000-0000-0000-000000000011', 6, '09:00', '10:00');
  perform dev.assert(true, 'accepted: Saturday 09:00 - within 08:00-13:00');
end $$;

\echo ''
\echo '=== POPIA: consent gates enrolment (s35) ==='
select pg_temp.rejects($$
  insert into public.enrolments (learner_id, package_code, status, start_date)
  values ('11111111-0000-0000-0000-00000000000a','group_2','active',current_date);
$$, 'activating an enrolment with NO guardian consent');

insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
select ct.code,'aaaaaaaa-0000-0000-0000-000000000001','11111111-0000-0000-0000-00000000000a',true,'1.0'
from public.consent_types ct where ct.is_required;
do $$ begin
  insert into public.enrolments (id, learner_id, package_code, status, start_date)
  values ('aaaa1111-0000-0000-0000-000000000013','11111111-0000-0000-0000-00000000000a',
          'group_2','active',current_date);
  perform dev.assert(true, 'accepted: enrolment activates once consent is recorded');
end $$;

select pg_temp.rejects($$
  insert into public.enrolments (learner_id, package_code, status, start_date)
  values ('22222222-0000-0000-0000-00000000000b','group_1','active',current_date);
$$, 'activating for a learner with no billing contact');

\echo ''
\echo '=== Package subject allowance ==='
do $$ begin
  insert into public.enrolment_subjects values
    ('aaaa1111-0000-0000-0000-000000000013','mathematics','english'),
    ('aaaa1111-0000-0000-0000-000000000013','english','english');
  perform dev.assert(true, 'accepted: 2 subjects on a 2-subject package');
end $$;
select pg_temp.rejects($$
  insert into public.enrolment_subjects values
    ('aaaa1111-0000-0000-0000-000000000013','afrikaans','afrikaans');
$$, 'a 3rd subject on a 2-subject package');

\echo ''
\echo '=== Class capacity ==='
insert into public.class_enrolments (class_group_id, learner_id, enrolment_id) values
  ('88888888-0000-0000-0000-000000000011','11111111-0000-0000-0000-00000000000a','aaaa1111-0000-0000-0000-000000000013');
insert into public.learner_guardians (learner_id, guardian_id, relationship, is_billing_contact)
  values ('22222222-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','mother',true);
insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
select ct.code,'aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-00000000000b',true,'1.0'
from public.consent_types ct where ct.is_required;
insert into public.enrolments (id, learner_id, package_code, status, start_date) values
  ('aaaa1111-0000-0000-0000-000000000023','22222222-0000-0000-0000-00000000000b','group_1','active',current_date);
insert into public.class_enrolments (class_group_id, learner_id, enrolment_id) values
  ('88888888-0000-0000-0000-000000000011','22222222-0000-0000-0000-00000000000b','aaaa1111-0000-0000-0000-000000000023');
do $$ begin perform dev.assert(true, 'accepted: 2 learners in a capacity-2 class'); end $$;

insert into public.learner_guardians (learner_id, guardian_id, relationship, is_billing_contact)
  values ('33333333-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-000000000001','mother',true);
insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
select ct.code,'aaaaaaaa-0000-0000-0000-000000000001','33333333-0000-0000-0000-00000000000c',true,'1.0'
from public.consent_types ct where ct.is_required;
insert into public.enrolments (id, learner_id, package_code, status, start_date) values
  ('aaaa1111-0000-0000-0000-000000000033','33333333-0000-0000-0000-00000000000c','group_1','active',current_date);
select pg_temp.rejects($$
  insert into public.class_enrolments (class_group_id, learner_id, enrolment_id) values
    ('88888888-0000-0000-0000-000000000011','33333333-0000-0000-0000-00000000000c','aaaa1111-0000-0000-0000-000000000033');
$$, 'a 3rd learner into a capacity-2 class');

\echo ''
\echo '=== Safeguarding: controlled collection (BP section 22) ==='
insert into public.class_sessions (id, class_group_id, session_date, starts_at, ends_at) values
  ('99999999-0000-0000-0000-000000000012','88888888-0000-0000-0000-000000000011',
   '2026-10-20','2026-10-20 14:00+02','2026-10-20 15:00+02');
insert into public.authorised_collectors (id, learner_id, full_name, relationship, phone) values
  ('cccc3333-0000-0000-0000-00000000001c','11111111-0000-0000-0000-00000000000a','Aunt A','aunt','060'),
  ('dddd4444-0000-0000-0000-00000000001d','22222222-0000-0000-0000-00000000000b','Uncle B','uncle','061');
do $$ begin
  insert into public.session_check_ins (class_session_id, learner_id, departed_at, collected_by)
  values ('99999999-0000-0000-0000-000000000012','11111111-0000-0000-0000-00000000000a',
          now(),'cccc3333-0000-0000-0000-00000000001c');
  perform dev.assert(true, 'accepted: collected by an authorised person');
end $$;
select pg_temp.rejects($$
  insert into public.session_check_ins (class_session_id, learner_id, departed_at, collected_by)
  values ('99999999-0000-0000-0000-000000000012','22222222-0000-0000-0000-00000000000b',
          now(),'cccc3333-0000-0000-0000-00000000001c');
$$, 'collection by someone authorised for a DIFFERENT child');

\echo ''
\echo '=== Temporal integrity ==='
select pg_temp.rejects($$
  insert into public.package_prices (package_code, amount_cents, effective_from)
  values ('group_1', 50000, '2026-06-01');
$$, 'a second overlapping price for the same package');
select pg_temp.rejects($$
  insert into public.tutor_pay_rates (tutor_id, pay_basis, amount_cents, effective_from) values
    ('44444444-0000-0000-0000-00000000000d','per_hour',10000,'2026-01-01');
  insert into public.tutor_pay_rates (tutor_id, pay_basis, amount_cents, effective_from) values
    ('44444444-0000-0000-0000-00000000000d','per_hour',12000,'2026-06-01');
$$, 'two overlapping pay rates for one tutor');
select pg_temp.rejects($$
  insert into public.terms (year, term_number, starts_on, ends_on)
  values (2026, 3, '2026-11-01', '2026-11-30');
$$, 'a term overlapping an existing term');
select pg_temp.rejects($$
  insert into public.learner_guardians (learner_id, guardian_id, relationship, is_billing_contact)
  values ('11111111-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-000000000003','father',true);
$$, 'a second billing contact for one learner');

\echo ''
\echo '=== In-centre class must have a room ==='
select pg_temp.rejects($$
  insert into public.class_groups (name,subject_code,language_code,tutor_id,term_id,delivery_mode,capacity)
  values ('No room','mathematics','english','44444444-0000-0000-0000-00000000000d',
          '66666666-0000-0000-0000-00000000000f','in_centre',5);
$$, 'an in-centre class with no room');

rollback;
SQL
