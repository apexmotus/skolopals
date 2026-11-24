-- Adaptive literacy and logic aptitude test.
-- SPEC-2026-11-enrolment-payments-ux.md §4.3, decision D15.
--
-- Where the logic lives. The adaptive engine (which item comes next, the
-- final band) is TypeScript in the API's aptitude module. The API runs every
-- query as the signed-in user's own role, so anything it can call in the
-- `public` schema a parent could also call straight through PostgREST with
-- the public anon key, and hand-pick easy items. So:
--   * every read and write goes through private.aptitude_* functions. The
--     `private` schema is not an exposed PostgREST schema, so those functions
--     are reachable from the API's direct connection only;
--   * each function also refuses to run inside a PostgREST request
--     (private.assert_not_rest), in case `private` is ever exposed by mistake;
--   * the tables give guardians no direct read of anything that would leak
--     the answer key or a result before the review decision;
--   * answer_id is never granted to anon or authenticated, admin included.
--     Correctness is worked out inside private.aptitude_answer.
--
-- The bank itself is loaded by db/seed/06_aptitude.sql, which
-- db/seed/aptitude/load.mjs generates from aptitude_test.json.

-- Bank ---------------------------------------------------------------------
create table public.aptitude_banks (
  version          text primary key check (version ~ '^\d+\.\d+\.\d+$'),
  test_id          text not null,
  title            text not null,
  instructions     text not null,
  audience_notes   text not null default '',
  blueprint        jsonb not null,
  adaptive         jsonb not null,
  scoring          jsonb not null,
  difficulty_bands jsonb not null,
  is_current       boolean not null default false,
  created_at       timestamptz not null default now()
);

-- At most one bank is served to new attempts.
create unique index aptitude_banks_one_current on public.aptitude_banks (is_current) where is_current;

create table public.aptitude_passages (
  bank_version text not null references public.aptitude_banks (version) on delete cascade,
  id           text not null,
  title        text not null,
  text         text not null,
  primary key (bank_version, id)
);

create table public.aptitude_items (
  bank_version text not null references public.aptitude_banks (version) on delete cascade,
  id           text not null,
  section      text not null check (section in ('literacy', 'logic')),
  skill        text not null,
  subskill     text,
  difficulty   smallint not null check (difficulty between 1 and 5),
  passage_id   text,
  stem         text not null,
  options      jsonb not null check (jsonb_typeof(options) = 'array'),
  answer_id    text not null,
  primary key (bank_version, id),
  foreign key (bank_version, passage_id) references public.aptitude_passages (bank_version, id),
  check ((section = 'literacy') = (passage_id is not null))
);

comment on column public.aptitude_items.answer_id is
  'The answer key. Never granted to anon or authenticated; read only inside private.aptitude_* functions.';

-- Attempts -----------------------------------------------------------------
create table public.aptitude_attempts (
  id                 uuid primary key default gen_random_uuid(),
  learner_id         uuid not null references public.learners (id) on delete cascade,
  enrolment_id       uuid not null references public.enrolments (id) on delete cascade,
  bank_version       text not null references public.aptitude_banks (version),
  status             text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  current_difficulty smallint not null check (current_difficulty between 1 and 5),
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  abandoned_at       timestamptz,
  abandoned_by       uuid references public.profiles (id),
  final_band         smallint check (final_band between 1 and 5),
  level_label        text,
  literacy_pct       smallint check (literacy_pct between 0 and 100),
  logic_pct          smallint check (logic_pct between 0 and 100),
  low_confidence     boolean,
  check ((status = 'completed') = (completed_at is not null)),
  check ((status = 'completed') = (final_band is not null)),
  check ((status = 'abandoned') = (abandoned_at is not null))
);

-- One live attempt per application. A retake abandons the old one first.
create unique index aptitude_attempts_one_live
  on public.aptitude_attempts (enrolment_id) where status <> 'abandoned';
create index on public.aptitude_attempts (learner_id);

comment on table public.aptitude_attempts is
  'One sitting of the aptitude test for an application. Result columns are read through '
  'private.aptitude_result, which applies the who-sees-what rules of SPEC §4.3.';

-- A served item is a row with no answer yet. Saving each answer as it is
-- given means a closed tab resumes at the same question.
create table public.aptitude_responses (
  attempt_id        uuid not null references public.aptitude_attempts (id) on delete cascade,
  seq               smallint not null check (seq > 0),
  bank_version      text not null,
  item_id           text not null,
  section           text not null check (section in ('literacy', 'logic')),
  difficulty_served smallint not null check (difficulty_served between 1 and 5),
  served_at         timestamptz not null default now(),
  chosen_option     text,
  is_correct        boolean,
  answered_at       timestamptz,
  ms_taken          integer check (ms_taken >= 0),
  primary key (attempt_id, seq),
  unique (attempt_id, item_id),
  foreign key (bank_version, item_id) references public.aptitude_items (bank_version, id),
  check ((answered_at is null) = (chosen_option is null)),
  check ((answered_at is null) = (is_correct is null))
);

-- Only one question is ever waiting for an answer.
create unique index aptitude_responses_one_pending
  on public.aptitude_responses (attempt_id) where answered_at is null;

-- Access -------------------------------------------------------------------
alter table public.aptitude_banks     enable row level security;
alter table public.aptitude_passages  enable row level security;
alter table public.aptitude_items     enable row level security;
alter table public.aptitude_attempts  enable row level security;
alter table public.aptitude_responses enable row level security;

-- Supabase's default privileges grant everything on new public tables to anon
-- and authenticated. Start from nothing and grant back only what is listed.
revoke all on public.aptitude_banks, public.aptitude_passages, public.aptitude_items,
              public.aptitude_attempts, public.aptitude_responses
  from anon, authenticated;

grant select on public.aptitude_banks, public.aptitude_passages to authenticated;
grant select (bank_version, id, section, skill, subskill, difficulty, passage_id, stem, options)
  on public.aptitude_items to authenticated;
-- Status only. Results come from private.aptitude_result.
grant select (id, learner_id, enrolment_id, bank_version, status, started_at, completed_at)
  on public.aptitude_attempts to authenticated;
grant select (attempt_id, seq, item_id, section, difficulty_served, served_at, answered_at)
  on public.aptitude_responses to authenticated;

-- The bank is not for parents: reading the items ahead would coach the test.
create policy "aptitude banks: admin read" on public.aptitude_banks
  for select to authenticated using ((select private.is_admin()));
create policy "aptitude passages: admin read" on public.aptitude_passages
  for select to authenticated using ((select private.is_admin()));
create policy "aptitude items: admin read" on public.aptitude_items
  for select to authenticated using ((select private.is_admin()));

-- A guardian may see whether their child's test is started or finished.
create policy "aptitude attempts: guardian or admin read" on public.aptitude_attempts
  for select to authenticated
  using ((select private.is_admin()) or (select private.is_guardian_of(learner_id)));

create policy "aptitude responses: admin read" on public.aptitude_responses
  for select to authenticated using ((select private.is_admin()));

-- Guards -------------------------------------------------------------------
-- PostgREST sets request.method on every request it serves. The API's own
-- connection never does, so a non-empty value means a REST call.
create or replace function private.assert_not_rest()
returns void language plpgsql stable set search_path = ''
as $fn$
begin
  if coalesce(current_setting('request.method', true), '') <> '' then
    raise exception 'Not available over the REST API' using errcode = '42501';
  end if;
end;
$fn$;

-- Loads an attempt the caller may act on (its learner's guardian, or admin),
-- locked for update. Anyone else gets "not found", so ids can't be probed.
create or replace function private.aptitude_lock_attempt(p_attempt_id uuid)
returns public.aptitude_attempts
language plpgsql security definer set search_path = ''
as $fn$
declare v_attempt public.aptitude_attempts;
begin
  select * into v_attempt from public.aptitude_attempts where id = p_attempt_id for update;
  if not found or not ((select private.is_admin()) or (select private.is_guardian_of(v_attempt.learner_id))) then
    raise exception 'Aptitude test not found' using errcode = 'P0001';
  end if;
  return v_attempt;
end;
$fn$;

-- Start or resume ----------------------------------------------------------
-- Returns the live attempt for the application, creating one if there is
-- none. A completed attempt is returned as-is: the test is taken once unless
-- an administrator allows a retake.
create or replace function private.aptitude_start(p_enrolment_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_enrolment public.enrolments;
  v_attempt   public.aptitude_attempts;
  v_bank      public.aptitude_banks;
begin
  perform private.assert_not_rest();

  select * into v_enrolment from public.enrolments where id = p_enrolment_id for update;
  if not found or not ((select private.is_admin()) or (select private.is_guardian_of(v_enrolment.learner_id))) then
    raise exception 'Application not found' using errcode = 'P0001';
  end if;

  select * into v_attempt from public.aptitude_attempts
   where enrolment_id = p_enrolment_id and status <> 'abandoned';
  if found then
    return jsonb_build_object('attemptId', v_attempt.id, 'status', v_attempt.status);
  end if;

  if v_enrolment.status <> 'pending' then
    raise exception 'The aptitude test can only be taken while the application is waiting for review'
      using errcode = 'P0001';
  end if;

  select * into v_bank from public.aptitude_banks where is_current;
  if not found then
    raise exception 'No aptitude test is available' using errcode = 'P0001';
  end if;

  insert into public.aptitude_attempts (learner_id, enrolment_id, bank_version, current_difficulty)
  values (v_enrolment.learner_id, p_enrolment_id, v_bank.version, (v_bank.adaptive ->> 'startDifficulty')::smallint)
  returning * into v_attempt;

  return jsonb_build_object('attemptId', v_attempt.id, 'status', v_attempt.status);
end;
$fn$;

-- Engine input -------------------------------------------------------------
-- Everything the API's engine needs to choose the next item: the bank's
-- shape (no stems, no answers) and what has been served so far.
create or replace function private.aptitude_state(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_attempt public.aptitude_attempts;
  v_bank    public.aptitude_banks;
begin
  perform private.assert_not_rest();
  v_attempt := private.aptitude_lock_attempt(p_attempt_id);
  select * into v_bank from public.aptitude_banks where version = v_attempt.bank_version;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'status', v_attempt.status,
    'gradeCode', (select grade_code from public.learners where id = v_attempt.learner_id),
    'bank', jsonb_build_object(
      'version', v_bank.version,
      'blueprint', v_bank.blueprint,
      'adaptive', v_bank.adaptive,
      'scoring', v_bank.scoring,
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', i.id, 'section', i.section, 'skill', i.skill,
                 'difficulty', i.difficulty, 'passageId', i.passage_id) order by i.id), '[]'::jsonb)
        from public.aptitude_items i where i.bank_version = v_bank.version)),
    'history', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'seq', r.seq, 'itemId', r.item_id, 'difficulty', r.difficulty_served,
               'answered', r.answered_at is not null,
               'isCorrect', r.is_correct) order by r.seq), '[]'::jsonb)
      from public.aptitude_responses r where r.attempt_id = v_attempt.id));
end;
$fn$;

-- Serve --------------------------------------------------------------------
-- Records the engine's choice as the waiting question, with the difficulty
-- the engine was testing at when it chose it (its running estimate, not the
-- item's own label: a strong learner can be handed an easy leftover passage).
-- Returns false, and changes nothing, when a question is already waiting
-- (two tabs racing).
create or replace function private.aptitude_serve(p_attempt_id uuid, p_item_id text, p_difficulty smallint)
returns boolean
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_attempt public.aptitude_attempts;
  v_item    public.aptitude_items;
  v_length  integer;
  v_served  integer;
begin
  perform private.assert_not_rest();
  v_attempt := private.aptitude_lock_attempt(p_attempt_id);
  if v_attempt.status <> 'in_progress' then
    raise exception 'This aptitude test is already finished' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.aptitude_responses where attempt_id = p_attempt_id and answered_at is null) then
    return false;
  end if;

  select (blueprint ->> 'testLength')::integer into v_length
    from public.aptitude_banks where version = v_attempt.bank_version;
  select count(*) into v_served from public.aptitude_responses where attempt_id = p_attempt_id;
  if v_served >= v_length then
    raise exception 'Every question has already been served' using errcode = 'P0001';
  end if;

  select * into v_item from public.aptitude_items
   where bank_version = v_attempt.bank_version and id = p_item_id;
  if not found then
    raise exception 'Unknown aptitude item' using errcode = 'P0001';
  end if;
  if p_difficulty not between 1 and 5 then
    raise exception 'Difficulty must be between 1 and 5' using errcode = 'P0001';
  end if;

  insert into public.aptitude_responses (attempt_id, seq, bank_version, item_id, section, difficulty_served)
  values (p_attempt_id, v_served + 1, v_attempt.bank_version, v_item.id, v_item.section, p_difficulty);

  update public.aptitude_attempts set current_difficulty = p_difficulty where id = p_attempt_id;
  return true;
end;
$fn$;

-- The waiting question as the child sees it: stem, options and passage.
-- Null when nothing is waiting.
create or replace function private.aptitude_current_item(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_attempt public.aptitude_attempts;
  v_result  jsonb;
begin
  perform private.assert_not_rest();
  v_attempt := private.aptitude_lock_attempt(p_attempt_id);

  select jsonb_build_object(
           'seq', r.seq,
           'total', (b.blueprint ->> 'testLength')::integer,
           'itemId', i.id,
           'section', i.section,
           'stem', i.stem,
           'options', i.options,
           'passage', case when p.id is null then null
                           else jsonb_build_object('id', p.id, 'title', p.title, 'text', p.text) end)
    into v_result
    from public.aptitude_responses r
    join public.aptitude_items i on i.bank_version = r.bank_version and i.id = r.item_id
    join public.aptitude_banks b on b.version = r.bank_version
    left join public.aptitude_passages p on p.bank_version = i.bank_version and p.id = i.passage_id
   where r.attempt_id = p_attempt_id and r.answered_at is null;

  return v_result;
end;
$fn$;

-- Answer -------------------------------------------------------------------
-- Only the waiting question can be answered, so a stale tab can't answer an
-- old one and nothing can be answered twice.
create or replace function private.aptitude_answer(
  p_attempt_id uuid, p_item_id text, p_option_id text, p_ms_taken integer)
returns void
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_attempt public.aptitude_attempts;
  v_item    public.aptitude_items;
begin
  perform private.assert_not_rest();
  v_attempt := private.aptitude_lock_attempt(p_attempt_id);
  if v_attempt.status <> 'in_progress' then
    raise exception 'This aptitude test is already finished' using errcode = 'P0001';
  end if;

  select i.* into v_item
    from public.aptitude_responses r
    join public.aptitude_items i on i.bank_version = r.bank_version and i.id = r.item_id
   where r.attempt_id = p_attempt_id and r.answered_at is null;
  if not found or v_item.id <> p_item_id then
    raise exception 'That question has already been answered' using errcode = 'P0001';
  end if;

  if not exists (select 1 from jsonb_array_elements(v_item.options) o where o ->> 'id' = p_option_id) then
    raise exception 'Choose one of the answers given' using errcode = 'P0001';
  end if;

  update public.aptitude_responses
     set chosen_option = p_option_id,
         is_correct    = (p_option_id = v_item.answer_id),
         answered_at   = now(),
         -- A tab left open overnight is not a 10-hour answer.
         ms_taken      = least(greatest(coalesce(p_ms_taken, 0), 0), 3600000)
   where attempt_id = p_attempt_id and answered_at is null;
end;
$fn$;

-- Complete -----------------------------------------------------------------
-- The engine's verdict. Refused until every question has been answered.
create or replace function private.aptitude_complete(
  p_attempt_id uuid, p_final_band smallint, p_level_label text,
  p_literacy_pct smallint, p_logic_pct smallint, p_low_confidence boolean)
returns void
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_attempt  public.aptitude_attempts;
  v_length   integer;
  v_answered integer;
begin
  perform private.assert_not_rest();
  v_attempt := private.aptitude_lock_attempt(p_attempt_id);
  if v_attempt.status <> 'in_progress' then
    raise exception 'This aptitude test is already finished' using errcode = 'P0001';
  end if;

  select (blueprint ->> 'testLength')::integer into v_length
    from public.aptitude_banks where version = v_attempt.bank_version;
  select count(*) into v_answered
    from public.aptitude_responses where attempt_id = p_attempt_id and answered_at is not null;
  if v_answered < v_length then
    raise exception 'The test is not finished yet' using errcode = 'P0001';
  end if;

  update public.aptitude_attempts
     set status = 'completed', completed_at = now(),
         final_band = p_final_band, level_label = p_level_label,
         literacy_pct = p_literacy_pct, logic_pct = p_logic_pct,
         low_confidence = p_low_confidence
   where id = p_attempt_id;
end;
$fn$;

-- Result -------------------------------------------------------------------
-- SPEC §4.3 "Who sees results":
--   admin      everything, including the per-item breakdown
--   tutor      the same minus the breakdown, once the learner is in their class
--   guardian   level, sub-scores and the tutor note, once the review is decided
-- The breakdown would reveal the bank, so only an administrator gets it.
create or replace function private.aptitude_result(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_attempt   public.aptitude_attempts;
  v_bank      public.aptitude_banks;
  v_status    text;
  v_is_admin  boolean := (select private.is_admin());
  v_summary   jsonb;
begin
  perform private.assert_not_rest();

  select * into v_attempt from public.aptitude_attempts where id = p_attempt_id;
  select status into v_status from public.enrolments where id = v_attempt.enrolment_id;

  if not found or not (
       v_is_admin
       or (select private.tutor_teaches(v_attempt.learner_id))
       or ((select private.is_guardian_of(v_attempt.learner_id)) and v_status <> 'pending')) then
    raise exception 'Aptitude result not found' using errcode = 'P0001';
  end if;
  if v_attempt.status <> 'completed' then
    raise exception 'The aptitude test is not finished yet' using errcode = 'P0001';
  end if;

  select * into v_bank from public.aptitude_banks where version = v_attempt.bank_version;

  v_summary := jsonb_build_object(
    'attemptId', v_attempt.id,
    'completedAt', v_attempt.completed_at,
    'levelLabel', v_attempt.level_label,
    'literacyPct', v_attempt.literacy_pct,
    'logicPct', v_attempt.logic_pct,
    'tutorNote', (select l ->> 'tutorNote' from jsonb_array_elements(v_bank.scoring -> 'levels') l
                   where l ->> 'label' = v_attempt.level_label));

  if not v_is_admin and not (select private.tutor_teaches(v_attempt.learner_id)) then
    return v_summary;
  end if;

  v_summary := v_summary || jsonb_build_object(
    'finalBand', v_attempt.final_band,
    'lowConfidence', v_attempt.low_confidence,
    'startedAt', v_attempt.started_at);

  if not v_is_admin then
    return v_summary;
  end if;

  return v_summary || jsonb_build_object('breakdown', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'seq', r.seq,
             'itemId', i.id,
             'section', i.section,
             'skill', i.skill,
             'difficulty', r.difficulty_served,
             'stem', i.stem,
             'chosenOption', r.chosen_option,
             'chosenText', (select o ->> 'text' from jsonb_array_elements(i.options) o where o ->> 'id' = r.chosen_option),
             'correctOption', i.answer_id,
             'correctText', (select o ->> 'text' from jsonb_array_elements(i.options) o where o ->> 'id' = i.answer_id),
             'isCorrect', r.is_correct,
             'msTaken', r.ms_taken) order by r.seq), '[]'::jsonb)
      from public.aptitude_responses r
      join public.aptitude_items i on i.bank_version = r.bank_version and i.id = r.item_id
     where r.attempt_id = v_attempt.id));
end;
$fn$;

-- Retake -------------------------------------------------------------------
-- Abandons the attempt so a fresh one can start. Administrators only, and
-- only while the application is still waiting for a decision.
create or replace function private.aptitude_retake(p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_attempt public.aptitude_attempts;
begin
  perform private.assert_not_rest();
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  v_attempt := private.aptitude_lock_attempt(p_attempt_id);
  if v_attempt.status = 'abandoned' then
    raise exception 'This attempt has already been set aside' using errcode = 'P0001';
  end if;
  if (select status from public.enrolments where id = v_attempt.enrolment_id) <> 'pending' then
    raise exception 'A retake is only possible while the application is waiting for review'
      using errcode = 'P0001';
  end if;

  update public.aptitude_attempts
     set status = 'abandoned', abandoned_at = now(), abandoned_by = (select auth.uid())
   where id = p_attempt_id;
end;
$fn$;

revoke execute on function
  private.assert_not_rest(),
  private.aptitude_lock_attempt(uuid),
  private.aptitude_start(uuid),
  private.aptitude_state(uuid),
  private.aptitude_serve(uuid, text, smallint),
  private.aptitude_current_item(uuid),
  private.aptitude_answer(uuid, text, text, integer),
  private.aptitude_complete(uuid, smallint, text, smallint, smallint, boolean),
  private.aptitude_result(uuid),
  private.aptitude_retake(uuid)
from public, anon;

grant execute on function
  private.assert_not_rest(),
  private.aptitude_lock_attempt(uuid),
  private.aptitude_start(uuid),
  private.aptitude_state(uuid),
  private.aptitude_serve(uuid, text, smallint),
  private.aptitude_current_item(uuid),
  private.aptitude_answer(uuid, text, text, integer),
  private.aptitude_complete(uuid, smallint, text, smallint, smallint, boolean),
  private.aptitude_result(uuid),
  private.aptitude_retake(uuid)
to authenticated;

-- D15: no approval without the online test ----------------------------------
-- A trigger rather than a check inside activate_enrolment, so it holds for
-- every path that moves an application out of pending.
create or replace function private.enrolment_requires_aptitude()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  if old.status = 'pending' and new.status = 'active' and not exists (
    select 1 from public.aptitude_attempts
     where enrolment_id = new.id and status = 'completed'
  ) then
    raise exception 'The learner must finish the aptitude test before the application can be approved'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger enrolments_require_aptitude
  before update of status on public.enrolments
  for each row execute function private.enrolment_requires_aptitude();
