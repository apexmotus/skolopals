-- The assessment cycle. BP section 12 and the value chain in section 10:
--   Assessment -> Learning Plan -> Tutoring -> Homework -> Testing
--               -> Progress Report -> Parent Feedback

create table public.assessment_types (
  code        text primary key,
  name        text not null,
  description text not null default '',
  sort_order  smallint not null
);

-- The domains the plan names for the initial assessment.
create table public.assessment_domains (
  code        text primary key,
  name        text not null,
  description text not null default '',
  sort_order  smallint not null
);

create table public.assessments (
  id                   uuid primary key default gen_random_uuid(),
  learner_id           uuid not null references public.learners (id) on delete cascade,
  assessment_type_code text not null references public.assessment_types (code),
  subject_code         text references public.subjects (code),
  grade_code           text not null references public.grades (code),
  term_id              uuid references public.terms (id) on delete set null,
  administered_by      uuid references public.tutors (id) on delete set null,
  assessed_on          date not null default current_date,
  overall_level_code   smallint references public.achievement_levels (code),
  notes                text not null default '',
  created_at           timestamptz not null default now()
);

create index on public.assessments (learner_id, assessed_on desc);
create index on public.assessments (term_id);

comment on column public.assessments.subject_code is
  'Null for the all-round initial assessment, which spans domains rather '
  'than a single subject.';
comment on column public.assessments.grade_code is
  'The grade the learner was in AT THE TIME. Copied here, not read from '
  'learners.grade_code, so year-on-year progress stays meaningful after the '
  'learner moves up a grade.';

-- One row per domain. This is the 4NF fix for "a score per domain": the old
-- shape would have been six columns or a single free-text score_label.
create table public.assessment_scores (
  id                     uuid primary key default gen_random_uuid(),
  assessment_id          uuid not null references public.assessments (id) on delete cascade,
  domain_code            text not null references public.assessment_domains (code),
  raw_score              numeric(6,2),
  max_score              numeric(6,2),
  achievement_level_code smallint references public.achievement_levels (code),
  comment                text not null default '',
  -- Same-row derivation: cannot drift, so a stored generated column is safe.
  percent numeric(5,2) generated always as (
    case when max_score is not null and max_score > 0
         then round(raw_score * 100 / max_score, 2) end
  ) stored,
  unique (assessment_id, domain_code),
  check (max_score is null or max_score > 0),
  check (raw_score is null or raw_score >= 0),
  check (raw_score is null or max_score is null or raw_score <= max_score)
);

-- Individual learning plan ------------------------------------------------
create table public.learning_plans (
  id                 uuid primary key default gen_random_uuid(),
  learner_id         uuid not null references public.learners (id) on delete cascade,
  from_assessment_id uuid references public.assessments (id) on delete set null,
  term_id            uuid references public.terms (id) on delete set null,
  status             text not null default 'draft'
    check (status in ('draft', 'active', 'completed', 'superseded')),
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  activated_at       timestamptz
);

create index on public.learning_plans (learner_id);

-- A learner has at most one active plan at a time.
create unique index learning_plan_one_active on public.learning_plans (learner_id)
  where status = 'active';

create table public.learning_plan_goals (
  id                uuid primary key default gen_random_uuid(),
  learning_plan_id  uuid not null references public.learning_plans (id) on delete cascade,
  subject_code      text not null references public.subjects (code),
  goal              text not null check (length(trim(goal)) > 0),
  target_level_code smallint references public.achievement_levels (code),
  target_date       date,
  status            text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'achieved', 'not_achieved')),
  review_note       text not null default ''
);

create index on public.learning_plan_goals (learning_plan_id);

-- Termly progress report --------------------------------------------------
create table public.progress_reports (
  id              uuid primary key default gen_random_uuid(),
  learner_id      uuid not null references public.learners (id) on delete cascade,
  term_id         uuid not null references public.terms (id) on delete restrict,
  tutor_id        uuid references public.tutors (id) on delete set null,
  summary         text not null default '',
  attendance_note text not null default '',
  issued_on       date,
  published_at    timestamptz,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  unique (learner_id, term_id)
);

create index on public.progress_reports (term_id);

-- Per subject: strengths, areas for improvement, recommended intervention.
-- The old schema made this one row per subject with no report identity, so a
-- four-subject report was four unrelated rows.
create table public.progress_report_subjects (
  id                       uuid primary key default gen_random_uuid(),
  progress_report_id       uuid not null references public.progress_reports (id) on delete cascade,
  subject_code             text not null references public.subjects (code),
  achievement_level_code   smallint references public.achievement_levels (code),
  strengths                text not null default '',
  areas_for_improvement    text not null default '',
  recommended_intervention text not null default '',
  unique (progress_report_id, subject_code)
);

-- Parent feedback, the final step of the value chain.
create table public.report_acknowledgements (
  progress_report_id uuid not null references public.progress_reports (id) on delete cascade,
  guardian_id        uuid not null references public.guardians (profile_id) on delete cascade,
  acknowledged_at    timestamptz not null default now(),
  comment            text not null default '',
  primary key (progress_report_id, guardian_id)
);

-- A report cannot be published without per-subject detail: an empty report
-- is worse than none, and parents are told the report covers their subjects.
create or replace function private.check_report_publishable()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  if new.published_at is not null and not exists (
    select 1 from public.progress_report_subjects where progress_report_id = new.id
  ) then
    raise exception 'Cannot publish a progress report with no subjects'
      using errcode = 'check_violation';
  end if;
  if new.published_at is not null and new.issued_on is null then
    new.issued_on := current_date;
  end if;
  return new;
end;
$fn$;

create trigger report_publishable
  before insert or update of published_at on public.progress_reports
  for each row execute function private.check_report_publishable();

-- A parent cannot acknowledge a report they have not been shown.
create or replace function private.check_ack_published()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  if not exists (
    select 1 from public.progress_reports
    where id = new.progress_report_id and published_at is not null
  ) then
    raise exception 'Cannot acknowledge an unpublished report'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger ack_requires_published
  before insert on public.report_acknowledgements
  for each row execute function private.check_ack_published();

alter table public.assessment_types        enable row level security;
alter table public.assessment_domains      enable row level security;
alter table public.assessments             enable row level security;
alter table public.assessment_scores       enable row level security;
alter table public.learning_plans          enable row level security;
alter table public.learning_plan_goals     enable row level security;
alter table public.progress_reports        enable row level security;
alter table public.progress_report_subjects enable row level security;
alter table public.report_acknowledgements enable row level security;
