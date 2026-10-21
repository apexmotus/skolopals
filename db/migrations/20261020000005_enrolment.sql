-- Enrolment. A parent picks a package, names the subjects and may nominate a
-- preferred tutor; an administrator approves, assigns and places the learner.

create table public.enrolments (
  id                       uuid primary key default gen_random_uuid(),
  learner_id               uuid not null references public.learners (id) on delete cascade,
  package_code             text not null references public.packages (code),
  status                   text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'ended', 'declined')),
  preferred_tutor_id       uuid references public.tutors (id) on delete set null,
  assigned_tutor_id        uuid references public.tutors (id) on delete set null,
  start_date               date,
  end_date                 date,

  -- Rule 6: admin sets the first month at their discretion. Null means the
  -- full package price. set_by / reason exist so the discretion is auditable.
  first_month_amount_cents integer check (first_month_amount_cents >= 0),
  first_month_set_by       uuid references public.profiles (id),
  first_month_reason       text,

  source                   text not null default 'website'
    check (source in ('website', 'walk_in', 'phone', 'referral', 'other')),
  created_at               timestamptz not null default now(),
  activated_at             timestamptz,
  check (end_date is null or start_date is null or end_date >= start_date),
  check ((status in ('active', 'paused', 'ended')) = (start_date is not null)),
  check (first_month_amount_cents is null or first_month_set_by is not null)
);

create index on public.enrolments (learner_id);
create index on public.enrolments (status);
create index on public.enrolments (assigned_tutor_id);

comment on column public.enrolments.preferred_tutor_id is
  'What the parent asked for (BR-10). assigned_tutor_id is what the centre '
  'decided. Keeping both means a reassignment never silently rewrites the ask.';

-- Which subjects fill the allowance, and in which medium ------------------
create table public.enrolment_subjects (
  enrolment_id            uuid not null references public.enrolments (id) on delete cascade,
  subject_code            text not null references public.subjects (code),
  preferred_language_code text references public.languages (code),
  primary key (enrolment_id, subject_code)
);

comment on column public.enrolment_subjects.preferred_language_code is
  'Medium of instruction the parent wants for THIS subject. A learner may take '
  'Mathematics in English and Physical Sciences in Afrikaans.';

-- The number of subjects may not exceed the package allowance.
create or replace function private.check_enrolment_subject_allowance()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_allowance smallint;
  v_count     integer;
  v_enrolment uuid := coalesce(new.enrolment_id, old.enrolment_id);
begin
  select p.subject_allowance into v_allowance
  from public.enrolments e
  join public.packages p on p.code = e.package_code
  where e.id = v_enrolment;

  if v_allowance is null then
    return null;  -- all-subject or not subject-based
  end if;

  select count(*) into v_count
  from public.enrolment_subjects where enrolment_id = v_enrolment;

  if v_count > v_allowance then
    raise exception
      'Package allows % subject(s); % selected', v_allowance, v_count
      using errcode = 'check_violation';
  end if;
  return null;
end;
$fn$;

create constraint trigger enrolment_subject_allowance
  after insert or update on public.enrolment_subjects
  deferrable initially deferred
  for each row execute function private.check_enrolment_subject_allowance();

-- A learner must have a billing contact before an enrolment can go active.
create or replace function private.check_enrolment_has_billing_contact()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
begin
  if new.status = 'active' and not exists (
    select 1 from public.learner_guardians
    where learner_id = new.learner_id and is_billing_contact
  ) then
    raise exception
      'Learner has no billing contact; cannot activate enrolment'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger enrolment_requires_billing_contact
  before insert or update of status on public.enrolments
  for each row execute function private.check_enrolment_has_billing_contact();

alter table public.enrolments         enable row level security;
alter table public.enrolment_subjects enable row level security;
