-- People: accounts, guardians, learners, safeguarding and tutors.
--
-- Key 4NF decisions, see docs/4nf-audit.md:
--   * role is a table, not a column - one person may be both parent and tutor
--   * a tutor's teaching ability is (tutor, subject, grade) together
--   * medium of instruction hangs off that competency, not off the tutor
--   * languages a tutor SPEAKS are independent, so they stay separate

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- Accounts -----------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  phone      text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Deliberately has NO role column - see user_roles.';

create type public.app_role as enum ('parent', 'learner', 'tutor', 'admin');

create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is
  'A person may hold several roles. In a small community centre a parent is '
  'plausibly also a tutor, which a single role column cannot express (4NF).';

-- Guardians ----------------------------------------------------------------
create table public.guardians (
  profile_id        uuid primary key references public.profiles (id) on delete cascade,
  physical_address  text not null default '',
  postal_address    text not null default '',
  preferred_contact text not null default 'whatsapp'
    check (preferred_contact in ('whatsapp', 'sms', 'email', 'phone')),
  created_at        timestamptz not null default now()
);

-- Learners -----------------------------------------------------------------
create table public.learners (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid unique references public.profiles (id) on delete set null,
  full_name          text not null check (length(trim(full_name)) > 0),
  date_of_birth      date not null check (date_of_birth > '1990-01-01'
                                      and date_of_birth < current_date),
  grade_code         text not null references public.grades (code),
  school_name        text not null default '',
  home_language_code text references public.languages (code),
  status             text not null default 'prospective'
    check (status in ('prospective', 'active', 'paused', 'left')),
  joined_on          date not null default current_date,
  left_on            date,
  created_at         timestamptz not null default now(),
  check (left_on is null or left_on >= joined_on),
  check ((status = 'left') = (left_on is not null))
);

create index on public.learners (grade_code);
create index on public.learners (status);

comment on column public.learners.profile_id is
  'Optional login for an older learner. Null for most children; the guardian '
  'consent still makes the processing lawful either way.';
comment on column public.learners.left_on is
  'Starts the POPIA retention clock. See data_retention_policies.';
comment on column public.learners.grade_code is
  'CURRENT grade. Assessments record the grade at the time of assessment '
  'separately, so year-on-year progress stays meaningful.';

-- Learner <-> guardian -----------------------------------------------------
create table public.learner_guardians (
  learner_id         uuid not null references public.learners (id) on delete cascade,
  guardian_id        uuid not null references public.guardians (profile_id) on delete cascade,
  relationship       text not null,
  is_primary         boolean not null default false,
  is_billing_contact boolean not null default false,
  primary key (learner_id, guardian_id)
);

create index on public.learner_guardians (guardian_id);

-- At most one primary contact and one billing contact per learner. "At least
-- one" is enforced when an enrolment is activated, not here, because the rows
-- are necessarily inserted one at a time.
create unique index learner_one_primary on public.learner_guardians (learner_id)
  where is_primary;
create unique index learner_one_billing on public.learner_guardians (learner_id)
  where is_billing_contact;

-- Safeguarding (BP section 22) ---------------------------------------------
create table public.learner_emergency_contacts (
  id           uuid primary key default gen_random_uuid(),
  learner_id   uuid not null references public.learners (id) on delete cascade,
  full_name    text not null,
  relationship text not null,
  phone        text not null,
  priority     smallint not null check (priority between 1 and 5),
  unique (learner_id, priority)
);

create table public.authorised_collectors (
  id              uuid primary key default gen_random_uuid(),
  learner_id      uuid not null references public.learners (id) on delete cascade,
  full_name       text not null,
  relationship    text not null,
  phone           text not null,
  id_number_last4 text check (id_number_last4 ~ '^[0-9]{4}$'),
  active_from     date not null default current_date,
  active_to       date,
  check (active_to is null or active_to >= active_from)
);

create index on public.authorised_collectors (learner_id);

comment on column public.authorised_collectors.id_number_last4 is
  'Last four digits only. POPIA minimality - enough to verify at the door, '
  'not enough to be worth stealing.';

create table public.learner_medical_notes (
  learner_id     uuid primary key references public.learners (id) on delete cascade,
  allergies      text not null default '',
  conditions     text not null default '',
  medication     text not null default '',
  accommodations text not null default '',
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id)
);

comment on table public.learner_medical_notes is
  'SPECIAL PERSONAL INFORMATION under POPIA s26. Admin-only RLS; tutors are '
  'explicitly denied. See docs/POPIA-policy.md A4.';

-- Tutors -------------------------------------------------------------------
create table public.tutors (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null unique references public.profiles (id) on delete cascade,
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  headline        text not null default '',
  bio             text not null default '',
  employment_type text not null check (employment_type in ('salaried', 'sessional')),
  status          text not null default 'active'
    check (status in ('active', 'suspended', 'inactive')),
  photo_url       text,
  started_on      date not null default current_date,
  ended_on        date,
  created_at      timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);

comment on column public.tutors.profile_id is
  'NOT NULL: tutors are created by an administrator and always have an '
  'account. There is no public tutor application (BR-23).';

-- Teaching ability ---------------------------------------------------------
-- (tutor, subject, grade) is ONE fact, not two independent ones. A tutor who
-- teaches Maths at Grades 4-7 and English at Grades 1-3 does not teach
-- Grade 1 Maths - which separate tutor_subjects / tutor_grades tables would
-- wrongly imply. The composite FK also stops a tutor being recorded as
-- competent in something the centre does not offer at that grade.
create table public.tutor_competencies (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null references public.tutors (id) on delete cascade,
  subject_code text not null,
  grade_code   text not null,
  unique (tutor_id, subject_code, grade_code),
  foreign key (subject_code, grade_code)
    references public.subject_offerings (subject_code, grade_code)
);

create index on public.tutor_competencies (subject_code, grade_code);

-- Medium of instruction. Depends on the competency, not on the tutor:
-- Physical Sciences in Afrikaans and Mathematics in English is a normal
-- combination, and must not imply Mathematics in Afrikaans.
create table public.tutor_competency_media (
  competency_id uuid not null references public.tutor_competencies (id) on delete cascade,
  language_code text not null references public.languages (code),
  primary key (competency_id, language_code)
);

-- Languages spoken for PARENT COMMUNICATION. Genuinely independent of what
-- the tutor teaches, so this one really is a separate binary relation.
create table public.tutor_spoken_languages (
  tutor_id      uuid not null references public.tutors (id) on delete cascade,
  language_code text not null references public.languages (code),
  primary key (tutor_id, language_code)
);

-- Vetting (BP section 13) --------------------------------------------------
create table public.tutor_qualifications (
  id                 uuid primary key default gen_random_uuid(),
  tutor_id           uuid not null references public.tutors (id) on delete cascade,
  qualification_type text not null
    check (qualification_type in ('degree', 'diploma', 'certificate', 'other')),
  title              text not null,
  institution        text not null default '',
  year_awarded       smallint check (year_awarded between 1950 and 2100),
  verified_at        timestamptz,
  verified_by        uuid references public.profiles (id)
);

create table public.tutor_documents (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null references public.tutors (id) on delete cascade,
  doc_type     text not null
    check (doc_type in ('id', 'qualification', 'police_clearance', 'cv', 'other')),
  storage_path text not null,
  uploaded_at  timestamptz not null default now(),
  verified_at  timestamptz,
  verified_by  uuid references public.profiles (id)
);

create table public.tutor_references (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null references public.tutors (id) on delete cascade,
  full_name    text not null,
  relationship text not null,
  phone        text not null default '',
  email        text not null default '',
  checked_at   timestamptz,
  checked_by   uuid references public.profiles (id),
  outcome      text check (outcome in ('positive', 'negative', 'unreachable'))
);

-- Pay (BP section 13, 17) --------------------------------------------------
-- Tutors are centre staff. There is no revenue share.
create table public.tutor_pay_rates (
  id             uuid primary key default gen_random_uuid(),
  tutor_id       uuid not null references public.tutors (id) on delete cascade,
  pay_basis      text not null
    check (pay_basis in ('monthly_salary', 'per_session', 'per_hour')),
  amount_cents   integer not null check (amount_cents > 0),
  effective_from date not null,
  effective_to   date,
  created_at     timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

-- A tutor cannot be on two rates at once.
alter table public.tutor_pay_rates
  add constraint tutor_pay_rates_no_overlap
  exclude using gist (
    tutor_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  );

-- New auth user -> profile + parent role -----------------------------------
-- Parents self-register. Tutors and admins are created by an administrator,
-- so no role can be self-selected at sign-up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'parent');
  insert into public.guardians (profile_id) values (new.id);
  return new;
end;
$fn$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Row level security ------------------------------------------------------
-- Enabled here; the policies themselves live in the RLS migration. Without
-- this, those policies would exist but never be consulted.
alter table public.profiles                   enable row level security;
alter table public.user_roles                 enable row level security;
alter table public.guardians                  enable row level security;
alter table public.learners                   enable row level security;
alter table public.learner_guardians          enable row level security;
alter table public.learner_emergency_contacts enable row level security;
alter table public.authorised_collectors      enable row level security;
alter table public.learner_medical_notes      enable row level security;
alter table public.tutors                     enable row level security;
alter table public.tutor_competencies         enable row level security;
alter table public.tutor_competency_media     enable row level security;
alter table public.tutor_spoken_languages     enable row level security;
alter table public.tutor_qualifications       enable row level security;
alter table public.tutor_documents            enable row level security;
alter table public.tutor_references           enable row level security;
alter table public.tutor_pay_rates            enable row level security;
