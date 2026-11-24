#!/usr/bin/env bash
# The aptitude test's database contract (SPEC-2026-11-enrolment-payments-ux.md
# §4.3): who may start, serve, answer and read results; that the answer key
# never reaches a parent or admin; that the private functions refuse a
# PostgREST call; and D15, no approval without a finished test. The adaptive
# choice of items is the API engine's job and is unit-tested there; this
# script serves items in a fixed order. Rolls back.
set -euo pipefail
DB="${DATABASE_URL:?DATABASE_URL not set}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo '=== the bank file is valid and its seed is up to date ==='
node "$DIR/seed/aptitude/load.mjs" --check

psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
set constraints all immediate;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','parent@test','{"full_name":"Thandi Mokoena"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002','other@test','{"full_name":"Other Parent"}'),
  ('cccccccc-0000-0000-0000-000000000003','tutor@test','{"full_name":"Naledi Dube"}'),
  ('dddddddd-0000-0000-0000-000000000004','admin@test','{"full_name":"Winnie Thobela"}');
insert into public.user_roles values
  ('cccccccc-0000-0000-0000-000000000003','tutor'),
  ('dddddddd-0000-0000-0000-000000000004','admin');
insert into public.tutors (id, profile_id, slug, employment_type) values
  ('44444444-0000-0000-0000-00000000000d','cccccccc-0000-0000-0000-000000000003','naledi-dube','sessional');

-- The answer key and one wrong option per item, read as the owner, so the
-- simulated child can answer right or wrong on purpose. The signed-in role
-- only ever sees this temp copy.
create temp table answer_key on commit drop as
  select i.id, i.section, i.answer_id,
         (select o ->> 'id' from jsonb_array_elements(i.options) o
           where o ->> 'id' <> i.answer_id limit 1) as wrong_id
    from public.aptitude_items i join public.aptitude_banks b on b.version = i.bank_version
   where b.is_current;
grant select on answer_key to authenticated;

\echo ''
\echo '=== PARENT applies for two children and starts the first test ==='
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true) \g /dev/null

select set_config('test.enrolment', (private.submit_enrolment(
  '{"full_name":"Thabo Mokoena","date_of_birth":"2013-04-02","grade_code":"grade_7","relationship":"mother"}'::jsonb,
  'group_1', '[{"subject_code":"mathematics","preferred_language_code":"english"}]'::jsonb,
  '[{"full_name":"Aunt Palesa","relationship":"aunt","phone":"0721234567","priority":1}]'::jsonb,
  '[]'::jsonb,
  (select jsonb_agg(jsonb_build_object('consent_type_code', code, 'granted', true))
     from public.consent_types where is_required),
  '1.0', '{"stagingPath":"staging/aaaaaaaa-0000-0000-0000-000000000001/3b6d7c1e-1f2a-4c3b-9d8e-7a6b5c4d3e2f.pdf","mime":"application/pdf","sizeBytes":1000}'::jsonb, null) ->> 'enrolmentId'), true) \g /dev/null

select set_config('test.second', (private.submit_enrolment(
  '{"full_name":"Lerato Mokoena","date_of_birth":"2016-02-10","grade_code":"grade_4","relationship":"mother"}'::jsonb,
  'group_1', '[{"subject_code":"mathematics","preferred_language_code":"english"}]'::jsonb,
  '[{"full_name":"Aunt Palesa","relationship":"aunt","phone":"0721234567","priority":1}]'::jsonb,
  '[]'::jsonb,
  (select jsonb_agg(jsonb_build_object('consent_type_code', code, 'granted', true))
     from public.consent_types where is_required),
  '1.0', '{"stagingPath":"staging/aaaaaaaa-0000-0000-0000-000000000001/4b6d7c1e-1f2a-4c3b-9d8e-7a6b5c4d3e2f.pdf","mime":"application/pdf","sizeBytes":1000}'::jsonb, null) ->> 'enrolmentId'), true) \g /dev/null

select set_config('test.attempt',
  private.aptitude_start(current_setting('test.enrolment')::uuid) ->> 'attemptId', true) \g /dev/null

do $$ begin
  perform dev.assert((select count(*) from public.aptitude_attempts) = 1, 'starting creates one attempt');
  perform dev.assert((select status from public.aptitude_attempts) = 'in_progress', 'the attempt is in progress');
  perform dev.assert(
    (private.aptitude_start(current_setting('test.enrolment')::uuid) ->> 'attemptId') = current_setting('test.attempt'),
    'starting again resumes the same attempt');
  perform dev.assert((select count(*) from public.aptitude_attempts) = 1, 'resuming creates nothing new');
end $$;

\echo ''
\echo '--- a parent sees whether the test is done, and nothing more ---'
do $$ begin
  perform dev.assert((select count(*) from public.aptitude_items) = 0, 'the item bank is hidden from parents');
  perform dev.assert((select count(*) from public.aptitude_passages) = 0, 'the passages are hidden from parents');
  perform dev.assert((select count(*) from public.aptitude_responses) = 0, 'served items are hidden from parents');
  begin
    perform answer_id from public.aptitude_items;
    raise exception 'FAILED: a parent could select answer_id';
  exception when insufficient_privilege then
    raise notice '  PASS  rejected: parent selecting the answer key';
  end;
  begin
    perform final_band from public.aptitude_attempts;
    raise exception 'FAILED: a parent could read the result columns directly';
  exception when insufficient_privilege then
    raise notice '  PASS  rejected: parent reading result columns directly';
  end;
  begin
    update public.aptitude_attempts set status = 'completed';
    raise exception 'FAILED: a parent could write an attempt directly';
  exception when insufficient_privilege then
    raise notice '  PASS  rejected: parent writing an attempt directly';
  end;
end $$;

\echo ''
\echo '--- the private functions are not reachable over REST ---'
do $$ begin
  perform set_config('request.method', 'POST', true);
  begin
    perform private.aptitude_state(current_setting('test.attempt')::uuid);
    raise exception 'FAILED: aptitude_state ran inside a REST request';
  exception when insufficient_privilege then
    raise notice '  PASS  rejected: aptitude function called inside a PostgREST request';
  end;
  perform set_config('request.method', '', true);

  perform dev.assert(not has_function_privilege('anon', 'private.aptitude_start(uuid)', 'execute'),
    'anon cannot execute the aptitude functions');
  perform dev.assert(not has_column_privilege('authenticated', 'public.aptitude_items', 'answer_id', 'select'),
    'no signed-in role, admin included, may select answer_id');
end $$;

\echo ''
\echo '--- another parent cannot reach the attempt ---'
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}',true) \g /dev/null
do $$ begin
  begin
    perform private.aptitude_state(current_setting('test.attempt')::uuid);
    raise exception 'FAILED: another parent read the attempt';
  exception when raise_exception then
    raise notice '  PASS  rejected: another parent reading the attempt';
  end;
  begin
    perform private.aptitude_start(current_setting('test.enrolment')::uuid);
    raise exception 'FAILED: another parent started the test';
  exception when raise_exception then
    raise notice '  PASS  rejected: another parent starting the test';
  end;
  perform dev.assert((select count(*) from public.aptitude_attempts) = 0, 'another parent sees no attempts');
end $$;

\echo ''
\echo '=== the child sits the test ==='
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true) \g /dev/null
do $$
declare
  v_attempt uuid := current_setting('test.attempt')::uuid;
  v_item  jsonb;
  v_state jsonb;
  v_key   record;
  v_n     integer := 1;
begin
  perform dev.assert(private.aptitude_current_item(v_attempt) is null, 'nothing is waiting before the first serve');
  perform dev.assert(private.aptitude_serve(v_attempt, 'LIT-01', 3::smallint), 'the first item is served');
  perform dev.assert(not private.aptitude_serve(v_attempt, 'LIT-02', 3::smallint),
    'a second serve while one is waiting changes nothing');

  v_item := private.aptitude_current_item(v_attempt);
  perform dev.assert(v_item ->> 'itemId' = 'LIT-01' and (v_item ->> 'seq')::int = 1 and (v_item ->> 'total')::int = 25,
    'the waiting question is item 1 of 25');
  perform dev.assert(v_item -> 'passage' ->> 'id' = 'P1', 'a reading question carries its passage');
  perform dev.assert(v_item::text not like '%answer%', 'the question carries no answer');

  begin
    perform private.aptitude_answer(v_attempt, 'LIT-02', 'A', 1000);
    raise exception 'FAILED: answered a question that was not waiting';
  exception when raise_exception then
    raise notice '  PASS  rejected: answering a question that is not the waiting one';
  end;
  begin
    perform private.aptitude_answer(v_attempt, 'LIT-01', 'Z', 1000);
    raise exception 'FAILED: accepted an option that does not exist';
  exception when raise_exception then
    raise notice '  PASS  rejected: an answer that is not one of the options';
  end;
  begin
    perform private.aptitude_serve(v_attempt, 'NOPE', 3::smallint);
    raise exception 'FAILED: served an item that is not in the bank';
  exception when raise_exception then
    raise notice '  PASS  rejected: serving an item that is not in the bank';
  end;
  begin
    perform private.aptitude_complete(v_attempt, 3::smallint, 'Developing', 50::smallint, 50::smallint, false);
    raise exception 'FAILED: completed an unfinished test';
  exception when raise_exception then
    raise notice '  PASS  rejected: completing before every question is answered';
  end;

  perform private.aptitude_answer(v_attempt, 'LIT-01', (select answer_id from answer_key where id = 'LIT-01'), 4200);
  v_state := private.aptitude_state(v_attempt);
  perform dev.assert((v_state -> 'history' -> 0 ->> 'isCorrect')::boolean, 'a right answer is marked right');
  perform dev.assert((v_state -> 'history' -> 0 ->> 'difficulty')::int = 3, 'the difficulty served is recorded');
  perform dev.assert(jsonb_array_length(v_state -> 'bank' -> 'items') = 55, 'the engine sees the whole bank shape');
  perform dev.assert((v_state -> 'bank' -> 'items')::text not like '%answer%', 'the engine never sees the answer key');
  perform dev.assert(v_state ->> 'gradeCode' = 'grade_7', 'the engine sees the learner''s grade');

  begin
    perform private.aptitude_answer(v_attempt, 'LIT-01', 'A', 1000);
    raise exception 'FAILED: answered the same question twice';
  exception when raise_exception then
    raise notice '  PASS  rejected: answering the same question twice';
  end;

  -- The other 24: 11 reading, 13 logic, alternating wrong and right.
  for v_key in
    (select id, answer_id, wrong_id from answer_key where section = 'literacy' and id <> 'LIT-01' order by id limit 11)
    union all
    (select id, answer_id, wrong_id from answer_key where section = 'logic' order by id limit 13)
  loop
    v_n := v_n + 1;
    perform private.aptitude_serve(v_attempt, v_key.id, 3::smallint);
    perform private.aptitude_answer(v_attempt, v_key.id,
      case when v_n % 2 = 0 then v_key.wrong_id else v_key.answer_id end, 1500);
  end loop;

  v_state := private.aptitude_state(v_attempt);
  perform dev.assert(jsonb_array_length(v_state -> 'history') = 25, 'all 25 questions answered');
  perform dev.assert((select count(*) from jsonb_array_elements(v_state -> 'history') h
                       where (h ->> 'isCorrect')::boolean) = 13, '13 of 25 right, as answered');

  begin
    perform private.aptitude_serve(v_attempt, 'LOG-PAT-05', 3::smallint);
    raise exception 'FAILED: served a 26th question';
  exception when raise_exception then
    raise notice '  PASS  rejected: serving past the test length';
  end;

  perform private.aptitude_complete(v_attempt, 3::smallint, 'Developing', 50::smallint, 54::smallint, false);
  perform dev.assert((select status from public.aptitude_attempts) = 'completed', 'the attempt is completed');
  perform dev.assert(
    (private.aptitude_start(current_setting('test.enrolment')::uuid) ->> 'status') = 'completed',
    'starting again returns the finished attempt rather than a new one');

  begin
    perform private.aptitude_result(v_attempt);
    raise exception 'FAILED: a guardian saw the result before the decision';
  exception when raise_exception then
    raise notice '  PASS  rejected: guardian reading the result while the application is pending';
  end;
end $$;

\echo ''
\echo '=== ADMIN reviews the result ==='
select set_config('request.jwt.claims','{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}',true) \g /dev/null
do $$
declare v_result jsonb := private.aptitude_result(current_setting('test.attempt')::uuid);
begin
  perform dev.assert(v_result ->> 'levelLabel' = 'Developing', 'admin sees the level');
  perform dev.assert((v_result ->> 'finalBand')::int = 3, 'admin sees the band');
  perform dev.assert(v_result ->> 'tutorNote' like 'Can read and reason%', 'the tutor note comes from the bank');
  perform dev.assert(jsonb_array_length(v_result -> 'breakdown') = 25, 'admin sees the per-item breakdown');
  perform dev.assert(v_result -> 'breakdown' -> 0 ->> 'correctOption' is not null, 'the breakdown shows the right answer');
  perform dev.assert((select count(*) from public.aptitude_responses) = 25, 'admin can read served items');
  perform dev.assert((select count(*) from public.aptitude_items) = 55, 'admin can read the bank');

  begin
    perform answer_id from public.aptitude_items;
    raise exception 'FAILED: admin could select answer_id directly';
  exception when insufficient_privilege then
    raise notice '  PASS  rejected: admin selecting the answer key directly';
  end;
end $$;

\echo ''
\echo '--- D15: no acceptance without a finished test ---'
do $$ begin
  begin
    perform public.accept_enrolment(current_setting('test.second')::uuid);
    raise exception 'FAILED: accepted an application with no aptitude test';
  exception when check_violation then
    raise notice '  PASS  rejected: accepting an application with no aptitude test';
  end;

  perform public.accept_enrolment(current_setting('test.enrolment')::uuid);
  perform dev.assert(
    (select status from public.enrolments where id = current_setting('test.enrolment')::uuid) = 'accepted',
    'an application with a finished test can be accepted');
end $$;

\echo '--- after the decision the guardian sees a summary only ---'
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true) \g /dev/null
do $$
declare v_result jsonb := private.aptitude_result(current_setting('test.attempt')::uuid);
begin
  perform dev.assert(v_result ->> 'levelLabel' = 'Developing' and (v_result ->> 'logicPct')::int = 54,
    'guardian sees the level and sub-scores');
  perform dev.assert(v_result ->> 'tutorNote' is not null, 'guardian sees what the level means');
  perform dev.assert(not (v_result ? 'breakdown'), 'guardian never sees the item breakdown');
  perform dev.assert(not (v_result ? 'finalBand'), 'guardian does not see the raw band');
end $$;

\echo ''
\echo '--- a tutor who does not teach the learner sees nothing ---'
select set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}',true) \g /dev/null
do $$ begin
  begin
    perform private.aptitude_result(current_setting('test.attempt')::uuid);
    raise exception 'FAILED: a tutor not teaching the learner saw the result';
  exception when raise_exception then
    raise notice '  PASS  rejected: tutor who does not teach the learner';
  end;
end $$;

\echo ''
\echo '=== a retake for the second child ==='
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true) \g /dev/null
select set_config('test.second_attempt',
  private.aptitude_start(current_setting('test.second')::uuid) ->> 'attemptId', true) \g /dev/null
do $$ begin
  begin
    perform private.aptitude_retake(current_setting('test.second_attempt')::uuid);
    raise exception 'FAILED: a parent allowed a retake';
  exception when raise_exception then
    raise notice '  PASS  rejected: a parent allowing a retake';
  end;
end $$;

select set_config('request.jwt.claims','{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}',true) \g /dev/null
do $$ begin
  perform private.aptitude_retake(current_setting('test.second_attempt')::uuid);
  perform dev.assert(
    (select status from public.aptitude_attempts where id = current_setting('test.second_attempt')::uuid) = 'abandoned',
    'the admin sets the attempt aside');
  begin
    perform private.aptitude_retake(current_setting('test.attempt')::uuid);
    raise exception 'FAILED: retake allowed after approval';
  exception when raise_exception then
    raise notice '  PASS  rejected: a retake once the application is decided';
  end;
end $$;

select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true) \g /dev/null
do $$
declare v_new jsonb := private.aptitude_start(current_setting('test.second')::uuid);
begin
  perform dev.assert(v_new ->> 'attemptId' <> current_setting('test.second_attempt'), 'starting again opens a fresh attempt');
  perform dev.assert(v_new ->> 'status' = 'in_progress', 'the fresh attempt is in progress');
  begin
    perform private.aptitude_serve(current_setting('test.second_attempt')::uuid, 'LOG-PAT-03', 3::smallint);
    raise exception 'FAILED: served into a set-aside attempt';
  exception when raise_exception then
    raise notice '  PASS  rejected: serving into a set-aside attempt';
  end;
end $$;

\echo ''
\echo 'aptitude: all checks passed'
rollback;
SQL
