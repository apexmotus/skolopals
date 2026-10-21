-- Assessment, learning plan and progress report operations.
-- BP section 12 and the value chain in section 10.

-- Record an assessment with its per-domain scores in one transaction.
-- An assessment with no scores is not a partial record, it is a useless one.
create or replace function public.record_assessment(
  p_learner_id uuid,
  p_type       text,
  p_grade_code text,
  p_assessed_on date,
  p_scores     jsonb,
  p_subject    text default null,
  p_term_id    uuid default null,
  p_notes      text default ''
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_tutor uuid := (select private.my_tutor_id());
  v_id    uuid;
  v_item  jsonb;
  v_level smallint;
begin
  if v_tutor is null and not (select private.is_admin()) then
    raise exception 'Only the teaching tutor or an administrator may record an assessment'
      using errcode = 'P0001';
  end if;
  if v_tutor is not null and not (select private.tutor_teaches(p_learner_id))
     and not (select private.is_admin()) then
    raise exception 'You do not teach this learner' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_scores, '[]'::jsonb)) = 0 then
    raise exception 'Record a score for at least one domain' using errcode = 'check_violation';
  end if;

  insert into public.assessments
    (learner_id, assessment_type_code, subject_code, grade_code, term_id, administered_by, assessed_on, notes)
  values (p_learner_id, p_type, p_subject, p_grade_code, p_term_id, v_tutor, p_assessed_on, coalesce(p_notes, ''))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_scores) loop
    -- The achievement level follows from the percentage, so derive it rather
    -- than asking the tutor to pick a band that might disagree with the mark.
    select code into v_level
    from public.achievement_levels
    where round((v_item ->> 'raw_score')::numeric * 100
                / nullif((v_item ->> 'max_score')::numeric, 0)) between min_percent and max_percent;

    insert into public.assessment_scores
      (assessment_id, domain_code, raw_score, max_score, achievement_level_code, comment)
    values (v_id, v_item ->> 'domain_code',
            (v_item ->> 'raw_score')::numeric,
            (v_item ->> 'max_score')::numeric,
            v_level,
            coalesce(v_item ->> 'comment', ''));
  end loop;

  return v_id;
end;
$fn$;

revoke execute on function public.record_assessment(uuid, text, text, date, jsonb, text, uuid, text) from public, anon;
grant execute on function public.record_assessment(uuid, text, text, date, jsonb, text, uuid, text) to authenticated;

-- Create an individual learning plan with its goals, superseding any current
-- one. A learner has at most one active plan (enforced by a unique index), so
-- the previous plan must be closed in the same transaction.
create or replace function public.create_learning_plan(
  p_learner_id    uuid,
  p_goals         jsonb,
  p_assessment_id uuid default null,
  p_term_id       uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare v_id uuid; v_item jsonb;
begin
  if not (select private.tutor_teaches(p_learner_id)) and not (select private.is_admin()) then
    raise exception 'You do not teach this learner' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_goals, '[]'::jsonb)) = 0 then
    raise exception 'A learning plan needs at least one goal' using errcode = 'check_violation';
  end if;

  update public.learning_plans set status = 'superseded'
   where learner_id = p_learner_id and status = 'active';

  insert into public.learning_plans
    (learner_id, from_assessment_id, term_id, status, created_by, activated_at)
  values (p_learner_id, p_assessment_id, p_term_id, 'active', (select auth.uid()), now())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_goals) loop
    insert into public.learning_plan_goals
      (learning_plan_id, subject_code, goal, target_level_code, target_date)
    values (v_id, v_item ->> 'subject_code', v_item ->> 'goal',
            nullif(v_item ->> 'target_level_code', '')::smallint,
            nullif(v_item ->> 'target_date', '')::date);
  end loop;

  return v_id;
end;
$fn$;

revoke execute on function public.create_learning_plan(uuid, jsonb, uuid, uuid) from public, anon;
grant execute on function public.create_learning_plan(uuid, jsonb, uuid, uuid) to authenticated;

-- Write a termly report and its per-subject detail. Saves as a draft; the
-- parent sees nothing until it is published.
create or replace function public.save_progress_report(
  p_learner_id uuid,
  p_term_id    uuid,
  p_summary    text,
  p_subjects   jsonb,
  p_publish    boolean default false,
  p_attendance_note text default ''
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare v_id uuid; v_item jsonb; v_tutor uuid := (select private.my_tutor_id());
begin
  if not (select private.tutor_teaches(p_learner_id)) and not (select private.is_admin()) then
    raise exception 'You do not teach this learner' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_subjects, '[]'::jsonb)) = 0 then
    raise exception 'A report must cover at least one subject' using errcode = 'check_violation';
  end if;

  insert into public.progress_reports
    (learner_id, term_id, tutor_id, summary, attendance_note, created_by)
  values (p_learner_id, p_term_id, v_tutor, coalesce(p_summary, ''), coalesce(p_attendance_note, ''),
          (select auth.uid()))
  on conflict (learner_id, term_id) do update
    set summary = excluded.summary,
        attendance_note = excluded.attendance_note,
        tutor_id = coalesce(excluded.tutor_id, public.progress_reports.tutor_id)
  returning id into v_id;

  -- Rewritten wholesale: a report is edited as a document, not row by row.
  delete from public.progress_report_subjects where progress_report_id = v_id;
  for v_item in select * from jsonb_array_elements(p_subjects) loop
    insert into public.progress_report_subjects
      (progress_report_id, subject_code, achievement_level_code, strengths,
       areas_for_improvement, recommended_intervention)
    values (v_id, v_item ->> 'subject_code',
            nullif(v_item ->> 'achievement_level_code', '')::smallint,
            coalesce(v_item ->> 'strengths', ''),
            coalesce(v_item ->> 'areas_for_improvement', ''),
            coalesce(v_item ->> 'recommended_intervention', ''));
  end loop;

  -- Publishing is a one-way door: once a parent has been shown a report it
  -- is not silently unpublished.
  if p_publish then
    update public.progress_reports
       set published_at = coalesce(published_at, now())
     where id = v_id;
  end if;

  return v_id;
end;
$fn$;

revoke execute on function public.save_progress_report(uuid, uuid, text, jsonb, boolean, text) from public, anon;
grant execute on function public.save_progress_report(uuid, uuid, text, jsonb, boolean, text) to authenticated;
