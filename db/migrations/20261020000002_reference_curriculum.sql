-- Reference and curriculum data: CAPS phases, grades, subjects, languages,
-- achievement levels, school terms, centre operating hours and rooms.
--
-- These are slow-moving lookups. Everything here is readable by the public;
-- only the table owner / service_role may write (no write policy exists).

-- CAPS phases --------------------------------------------------------------
create table public.school_phases (
  code       text primary key,
  name       text not null unique,
  sort_order smallint not null unique
);

comment on table public.school_phases is
  'CAPS school phases. Business plan section 5.';

-- Grades -------------------------------------------------------------------
-- A grade determines its phase, so phase is stored ONCE here and never
-- duplicated onto a learner. Storing phase on learners would be a transitive
-- dependency (learner -> grade -> phase) and break 3NF.
create table public.grades (
  code       text primary key,
  name       text not null unique,
  phase_code text not null references public.school_phases (code),
  sort_order smallint not null unique
);

create index on public.grades (phase_code);

comment on table public.grades is
  'Grade R to Grade 12. phase_code is the only place the grade->phase fact lives.';

-- Subjects -----------------------------------------------------------------
create table public.subjects (
  code         text primary key,
  name         text not null unique,
  description  text not null default '',
  is_language  boolean not null default false,
  sort_order   smallint not null
);

comment on column public.subjects.is_language is
  'True where the subject IS a language (English, Afrikaans). Distinct from the '
  'medium of instruction a subject is taught in - see tutor_competency_media.';

-- Which subjects the centre offers at which grade -------------------------
-- Subject and grade are NOT independent: the centre offers Accounting only at
-- FET, Reading only at Foundation. This binary relation is the fact itself,
-- not a decomposition of two independent ones.
create table public.subject_offerings (
  subject_code text not null references public.subjects (code) on delete cascade,
  grade_code   text not null references public.grades (code) on delete cascade,
  primary key (subject_code, grade_code)
);

create index on public.subject_offerings (grade_code);

comment on table public.subject_offerings is
  'Subjects offered per grade. Business plan section 5.';

-- Languages ----------------------------------------------------------------
-- Used for two different purposes, kept apart in later migrations:
--   * medium of instruction, which depends on what is being taught
--   * languages a tutor speaks, for parent communication
create table public.languages (
  code       text primary key,
  name       text not null unique,
  sort_order smallint not null unique
);

-- CAPS 7-point achievement scale ------------------------------------------
create table public.achievement_levels (
  code        smallint primary key check (code between 1 and 7),
  label       text not null unique,
  description text not null default '',
  min_percent smallint not null check (min_percent between 0 and 100),
  max_percent smallint not null check (max_percent between 0 and 100),
  check (min_percent <= max_percent)
);

-- The bands must tile 0-100 exactly: no gaps, no overlaps. Enforced by an
-- exclusion constraint rather than trusted to the seed.
create extension if not exists btree_gist;

alter table public.achievement_levels
  add constraint achievement_levels_no_overlap
  exclude using gist (int4range(min_percent, max_percent, '[]') with &&);

comment on table public.achievement_levels is
  'CAPS 7-point achievement scale. Business plan section 12.';

-- School terms -------------------------------------------------------------
-- Deliberately NOT seeded. Official term dates are entered by an administrator
-- before go-live so the system can never disagree with the schools learners
-- actually attend. See BRS dependency D-01.
create table public.terms (
  id          uuid primary key default gen_random_uuid(),
  year        smallint not null check (year between 2020 and 2100),
  term_number smallint not null check (term_number between 1 and 4),
  starts_on   date not null,
  ends_on     date not null,
  created_at  timestamptz not null default now(),
  unique (year, term_number),
  check (starts_on < ends_on)
);

-- No two terms may overlap, in any year.
alter table public.terms
  add constraint terms_no_overlap
  exclude using gist (daterange(starts_on, ends_on, '[]') with &&);

comment on table public.terms is
  'SA school terms. Admin-entered, never seeded - see BRS D-01.';

-- Centre operating hours ---------------------------------------------------
-- Business plan section 11. A day may have more than one block (e.g. a day
-- used for tutoring in the afternoon and administration in the evening), so
-- the key is the day plus the opening time.
create table public.centre_operating_hours (
  day_of_week public.iso_dow not null,
  opens_at    time not null,
  closes_at   time not null,
  purpose     text not null check (purpose in ('tutoring', 'administration')),
  primary key (day_of_week, opens_at),
  check (opens_at < closes_at)
);

comment on table public.centre_operating_hours is
  'When the centre is open and for what. Validates class scheduling. BP section 11.';

-- Rooms --------------------------------------------------------------------
-- Not seeded: the centre's actual rooms are entered by an administrator.
create table public.rooms (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  capacity  smallint not null check (capacity > 0),
  is_active boolean not null default true
);

-- Row level security -------------------------------------------------------
-- Reference data is world-readable. No write policy exists, so only the table
-- owner and service_role can modify it; admin write paths arrive in Phase 1.
alter table public.school_phases          enable row level security;
alter table public.grades                 enable row level security;
alter table public.subjects               enable row level security;
alter table public.subject_offerings      enable row level security;
alter table public.languages              enable row level security;
alter table public.achievement_levels     enable row level security;
alter table public.terms                  enable row level security;
alter table public.centre_operating_hours enable row level security;
alter table public.rooms                  enable row level security;

create policy "school_phases: public read"          on public.school_phases          for select to anon, authenticated using (true);
create policy "grades: public read"                 on public.grades                 for select to anon, authenticated using (true);
create policy "subjects: public read"               on public.subjects               for select to anon, authenticated using (true);
create policy "subject_offerings: public read"      on public.subject_offerings      for select to anon, authenticated using (true);
create policy "languages: public read"              on public.languages              for select to anon, authenticated using (true);
create policy "achievement_levels: public read"     on public.achievement_levels     for select to anon, authenticated using (true);
create policy "terms: public read"                  on public.terms                  for select to anon, authenticated using (true);
create policy "operating_hours: public read"        on public.centre_operating_hours for select to anon, authenticated using (true);
create policy "rooms: public read"                  on public.rooms                  for select to anon, authenticated using (true);

grant select on
  public.school_phases,
  public.grades,
  public.subjects,
  public.subject_offerings,
  public.languages,
  public.achievement_levels,
  public.terms,
  public.centre_operating_hours,
  public.rooms
to anon, authenticated;
