#!/usr/bin/env bash
# Tutor administration and the assessment cycle:
# create tutor -> competency -> pay rate -> assess -> learning plan ->
# termly report -> publish -> parent acknowledges. Rolls back.
set -euo pipefail
DB="${DATABASE_URL:?DATABASE_URL not set}"

psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
set constraints all immediate;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','parent@test','{"full_name":"Thandi Mokoena"}'),
  ('cccccccc-0000-0000-0000-000000000003','naledi@test','{"full_name":"Naledi Dube"}'),
  ('eeeeeeee-0000-0000-0000-000000000005','other@test','{"full_name":"Other Tutor"}'),
  ('dddddddd-0000-0000-0000-000000000004','admin@test','{"full_name":"Winnie Thobela"}');
insert into public.user_roles values ('dddddddd-0000-0000-0000-000000000004','admin');
insert into public.terms (id, year, term_number, starts_on, ends_on) values
  ('66666666-0000-0000-0000-00000000000f', 2026, 4, '2026-10-06', '2026-11-03');
insert into public.rooms (id, name, capacity) values ('77777777-0000-0000-0000-000000000010','Main Room',12);

create or replace function pg_temp.rejects(p_sql text, p_what text)
returns void language plpgsql as $fn$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm like 'FAILED:%' then raise; end if;
    raise notice '  PASS  rejected: %', p_what; return;
  end;
  raise exception 'FAILED: % was ACCEPTED', p_what;
end; $fn$;

\echo ''
\echo '=== ADMIN creates a tutor from an existing account ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}',true);

select public.create_tutor('naledi@test','naledi-dube','sessional','Mathematics and English') as tutor_id \gset
do $$ begin
  perform dev.assert((select count(*) from public.tutors) = 1, 'tutor record created');
  perform dev.assert(exists(select 1 from public.user_roles
                            where user_id='cccccccc-0000-0000-0000-000000000003' and role='tutor'),
    'tutor role granted');
end $$;

select pg_temp.rejects($$ select public.create_tutor('nobody@test','nobody','sessional'); $$,
  'creating a tutor for an email with no account');
select pg_temp.rejects($$ select public.create_tutor('naledi@test','naledi-2','salaried'); $$,
  'making the same person a tutor twice');

\echo ''
\echo '=== Competencies: subject x grade x medium ==='
select public.set_tutor_competency(:'tutor_id','mathematics','grade_7', array['english']) as c1 \gset
select public.set_tutor_competency(:'tutor_id','english','grade_7', array['english','afrikaans']) as c2 \gset
do $$ begin
  perform dev.assert((select count(*) from public.tutor_competencies) = 2, 'two competencies recorded');
  perform dev.assert((select count(*) from public.tutor_competency_media) = 3,
    'English is taught in two languages, Mathematics in one');
end $$;
select pg_temp.rejects($$ select public.set_tutor_competency(
    (select id from public.tutors),'mathematics','grade_7', array[]::text[]); $$,
  'a competency with no language of instruction');

-- Re-setting replaces the media rather than accumulating them.
select public.set_tutor_competency(:'tutor_id','english','grade_7', array['english']) as c2b \gset
do $$ begin
  perform dev.assert((select count(*) from public.tutor_competency_media) = 2,
    're-setting a competency replaces its languages, it does not append');
end $$;

\echo ''
\echo '=== Pay rates never overlap ==='
select public.set_tutor_pay_rate(:'tutor_id','per_hour', 12000, '2026-01-01') as r1 \gset
select public.set_tutor_pay_rate(:'tutor_id','per_hour', 14000, '2026-07-01') as r2 \gset
do $$ begin
  perform dev.assert((select count(*) from public.tutor_pay_rates) = 2, 'two rates recorded');
  perform dev.assert((select effective_to from public.tutor_pay_rates where effective_from='2026-01-01')
                     = '2026-07-01', 'the earlier rate was closed automatically');
  perform dev.assert((select count(*) from public.tutor_pay_rates where effective_to is null) = 1,
    'exactly one open rate');
end $$;

\echo ''
\echo '=== Set up a class and a placed learner ==='
insert into public.learners (id, full_name, date_of_birth, grade_code, status) values
  ('11111111-0000-0000-0000-00000000000a','Thabo Mokoena','2013-04-02','grade_7','active'),
  ('22222222-0000-0000-0000-00000000000b','Not Mine','2013-06-02','grade_7','active');
insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact)
values ('11111111-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','mother',true,true);
insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
select code,'aaaaaaaa-0000-0000-0000-000000000001','11111111-0000-0000-0000-00000000000a',true,'1.0'
from public.consent_types where is_required;
insert into public.enrolments (id, learner_id, package_code, status, start_date)
values ('aaaa1111-0000-0000-0000-000000000013','11111111-0000-0000-0000-00000000000a','group_2','active',current_date);
insert into public.class_groups (id, name, subject_code, language_code, tutor_id, term_id, delivery_mode, room_id, capacity)
values ('88888888-0000-0000-0000-000000000011','Gr 7 Maths','mathematics','english',
        (select id from public.tutors),'66666666-0000-0000-0000-00000000000f','in_centre',
        '77777777-0000-0000-0000-000000000010',6);
insert into public.class_group_grades values ('88888888-0000-0000-0000-000000000011','grade_7');
insert into public.class_enrolments (class_group_id, learner_id, enrolment_id)
values ('88888888-0000-0000-0000-000000000011','11111111-0000-0000-0000-00000000000a','aaaa1111-0000-0000-0000-000000000013');

reset role;
\echo ''
\echo '=== TUTOR records the initial assessment ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}',true);

select public.record_assessment(
  '11111111-0000-0000-0000-00000000000a', 'initial', 'grade_7', '2026-10-19',
  '[{"domain_code":"reading","raw_score":22,"max_score":50},
    {"domain_code":"spelling","raw_score":18,"max_score":40},
    {"domain_code":"comprehension","raw_score":15,"max_score":50},
    {"domain_code":"writing","raw_score":28,"max_score":40},
    {"domain_code":"mathematics","raw_score":41,"max_score":50},
    {"domain_code":"language","raw_score":24,"max_score":50}]'::jsonb,
  null, '66666666-0000-0000-0000-00000000000f', 'Reads hesitantly; strong number sense.'
) as assessment_id \gset

do $$ begin
  perform dev.assert((select count(*) from public.assessment_scores) = 6, 'all six domains scored');
  perform dev.assert((select percent from public.assessment_scores where domain_code='comprehension') = 30.00,
    'percent derived per domain (15/50 = 30%)');
  -- 30% falls in band 2 (30-39), 82% in band 7 (80-100).
  perform dev.assert((select achievement_level_code from public.assessment_scores where domain_code='comprehension') = 2,
    'achievement level DERIVED from the mark, not typed in (30% -> level 2)');
  perform dev.assert((select achievement_level_code from public.assessment_scores where domain_code='mathematics') = 7,
    'mathematics 41/50 = 82% -> level 7');
end $$;

select pg_temp.rejects($$
  select public.record_assessment('22222222-0000-0000-0000-00000000000b','initial','grade_7',current_date,
    '[{"domain_code":"reading","raw_score":1,"max_score":10}]'::jsonb); $$,
  'assessing a learner this tutor does not teach');
select pg_temp.rejects($$
  select public.record_assessment('11111111-0000-0000-0000-00000000000a','monthly','grade_7',current_date,
    '[]'::jsonb); $$,
  'an assessment with no domain scores');

\echo ''
\echo '=== TUTOR writes the learning plan ==='
select public.create_learning_plan(
  '11111111-0000-0000-0000-00000000000a',
  '[{"subject_code":"english","goal":"Raise comprehension to grade level","target_level_code":"4","target_date":"2026-12-09"},
    {"subject_code":"mathematics","goal":"Secure fractions and ratios","target_level_code":"6","target_date":"2026-12-09"}]'::jsonb,
  :'assessment_id', '66666666-0000-0000-0000-00000000000f'
) as plan_id \gset
do $$ begin
  perform dev.assert((select count(*) from public.learning_plan_goals) = 2, 'two goals recorded');
  perform dev.assert((select from_assessment_id from public.learning_plans where status='active') is not null,
    'the plan is linked to the assessment it came from');
end $$;

-- A second plan supersedes the first rather than colliding with it.
select public.create_learning_plan('11111111-0000-0000-0000-00000000000a',
  '[{"subject_code":"english","goal":"Revised goal"}]'::jsonb) as plan2 \gset
do $$ begin
  perform dev.assert((select count(*) from public.learning_plans where status='active') = 1,
    'still exactly one active plan');
  perform dev.assert((select count(*) from public.learning_plans where status='superseded') = 1,
    'the previous plan was superseded, not deleted');
end $$;

\echo ''
\echo '=== TUTOR drafts the termly report ==='
select public.save_progress_report(
  '11111111-0000-0000-0000-00000000000a', '66666666-0000-0000-0000-00000000000f',
  'Thabo has settled well and his confidence is growing.',
  '[{"subject_code":"english","achievement_level_code":"4","strengths":"Reading fluency improved","areas_for_improvement":"Comprehension","recommended_intervention":"Weekly guided reading"},
    {"subject_code":"mathematics","achievement_level_code":"6","strengths":"Confident with operations","areas_for_improvement":"Fractions","recommended_intervention":"Targeted worksheets"}]'::jsonb,
  false, 'Attended 9 of 9 sessions.'
) as report_id \gset
do $$ begin
  perform dev.assert((select count(*) from public.progress_report_subjects) = 2, 'two subjects on the report');
  perform dev.assert((select published_at from public.progress_reports) is null, 'saved as a draft');
end $$;

reset role;
\echo ''
\echo '--- a parent cannot see an unpublished report ---'
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ begin
  perform dev.assert((select count(*) from public.progress_reports) = 0, 'draft is invisible to the parent');
  perform dev.assert((select count(*) from public.assessments) = 1, 'but assessments are visible');
end $$;
select pg_temp.rejects($$
  insert into public.report_acknowledgements (progress_report_id, guardian_id)
  values ((select id from public.progress_reports), 'aaaaaaaa-0000-0000-0000-000000000001'); $$,
  'acknowledging a report the parent cannot even see');

reset role;
\echo ''
\echo '=== TUTOR publishes; PARENT acknowledges ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}',true);
select public.save_progress_report(
  '11111111-0000-0000-0000-00000000000a', '66666666-0000-0000-0000-00000000000f',
  'Thabo has settled well and his confidence is growing.',
  '[{"subject_code":"english","achievement_level_code":"4","strengths":"Reading fluency improved","areas_for_improvement":"Comprehension","recommended_intervention":"Weekly guided reading"},
    {"subject_code":"mathematics","achievement_level_code":"6","strengths":"Confident with operations","areas_for_improvement":"Fractions","recommended_intervention":"Targeted worksheets"}]'::jsonb,
  true, 'Attended 9 of 9 sessions.'
) as published \gset
do $$ begin
  perform dev.assert((select count(*) from public.progress_reports) = 1, 're-saving updates, does not duplicate');
  perform dev.assert((select published_at from public.progress_reports) is not null, 'now published');
  perform dev.assert((select issued_on from public.progress_reports) is not null, 'issued_on set on publish');
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ begin
  perform dev.assert((select count(*) from public.progress_reports) = 1, 'parent now sees the report');
  perform dev.assert((select count(*) from public.progress_report_subjects) = 2, 'and its per-subject detail');
end $$;
insert into public.report_acknowledgements (progress_report_id, guardian_id, comment)
values ((select id from public.progress_reports), 'aaaaaaaa-0000-0000-0000-000000000001',
        'Thank you, we will practise reading at home.');
do $$ begin
  perform dev.assert((select count(*) from public.report_acknowledgements) = 1,
    'parent feedback closes the value chain (BP section 10)');
end $$;

\echo ''
\echo '=== Improvement is measurable ==='
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}',true);
select public.record_assessment(
  '11111111-0000-0000-0000-00000000000a', 'monthly', 'grade_7', '2026-11-02',
  '[{"domain_code":"comprehension","raw_score":30,"max_score":50}]'::jsonb) as a2 \gset
do $$ begin
  perform dev.assert(
    (select change_pct from public.v_assessment_improvement
      where learner_id='11111111-0000-0000-0000-00000000000a' and domain_code='comprehension') = 30.00,
    'comprehension improved 30% -> 60%, a +30 point change');
end $$;

reset role;
rollback;
SQL
