-- Timetable, attendance and the safeguarding sign-in/out log.
-- BP sections 11, 12 and 22.
--
-- Teaching is organised as recurring weekly classes that learners are enrolled
-- into. One-on-one tuition is the same mechanism with capacity 1.

create table public.class_groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  subject_code  text not null references public.subjects (code),
  language_code text not null references public.languages (code),
  tutor_id      uuid not null references public.tutors (id) on delete restrict,
  term_id       uuid not null references public.terms (id) on delete restrict,
  delivery_mode text not null check (delivery_mode in ('in_centre', 'online', 'hybrid')),
  room_id       uuid references public.rooms (id) on delete set null,
  capacity      smallint not null check (capacity between 1 and 30),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  -- An in-centre class has to happen somewhere.
  check (delivery_mode = 'online' or room_id is not null)
);

create index on public.class_groups (term_id);
create index on public.class_groups (tutor_id);

comment on column public.class_groups.language_code is
  'Medium of instruction. A class is delivered in one language, so parents can '
  'be offered "Grade 11 Physical Sciences (Afrikaans)" as a distinct class.';
comment on column public.class_groups.capacity is
  'One-on-one tuition is capacity 1 - the same timetable mechanism, not a '
  'second scheduling system.';

-- A class may span more than one grade (e.g. a combined Grade 4-5 group).
create table public.class_group_grades (
  class_group_id uuid not null references public.class_groups (id) on delete cascade,
  grade_code     text not null references public.grades (code),
  primary key (class_group_id, grade_code)
);

-- The assigned tutor must actually be competent in this subject, at every
-- grade the class covers, AND able to teach it in this medium. Without this,
-- "Grade 11 Physical Sciences (Afrikaans)" could be handed to a tutor who
-- only teaches it in English.
create or replace function private.check_class_tutor_competent()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_class   public.class_groups;
  v_missing text;
  v_id      uuid;
begin
  -- Fires on two tables whose key column differs, so pick it by table name.
  -- Referencing new.id on class_group_grades would fail at runtime.
  if tg_table_name = 'class_groups' then
    v_id := new.id;
  else
    v_id := new.class_group_id;
  end if;

  select * into v_class from public.class_groups where id = v_id;
  if not found then return null; end if;

  select string_agg(g.grade_code, ', ') into v_missing
  from public.class_group_grades g
  where g.class_group_id = v_class.id
    and not exists (
      select 1
      from public.tutor_competencies tc
      join public.tutor_competency_media tm on tm.competency_id = tc.id
      where tc.tutor_id     = v_class.tutor_id
        and tc.subject_code = v_class.subject_code
        and tc.grade_code   = g.grade_code
        and tm.language_code = v_class.language_code
    );

  if v_missing is not null then
    raise exception
      'Tutor is not recorded as teaching % in % at: %',
      v_class.subject_code, v_class.language_code, v_missing
      using errcode = 'check_violation';
  end if;
  return null;
end;
$fn$;

create constraint trigger class_tutor_competent
  after insert or update on public.class_groups
  deferrable initially deferred
  for each row execute function private.check_class_tutor_competent();

create constraint trigger class_grade_tutor_competent
  after insert or update on public.class_group_grades
  deferrable initially deferred
  for each row execute function private.check_class_tutor_competent();

-- The recurring weekly pattern. A class meeting Tuesday AND Thursday is two
-- rows - a repeating group, so it gets its own table.
create table public.class_schedules (
  id             uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references public.class_groups (id) on delete cascade,
  day_of_week    public.iso_dow not null,
  starts_at_time time not null,
  ends_at_time   time not null,
  unique (class_group_id, day_of_week, starts_at_time),
  check (starts_at_time < ends_at_time)
);

-- A class held at the centre must fall inside the centre's opening hours.
-- Online classes are exempt: they do not need the building.
create or replace function private.check_schedule_within_hours()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_mode text;
begin
  select delivery_mode into v_mode
  from public.class_groups where id = new.class_group_id;

  if v_mode = 'online' then return new; end if;

  if not exists (
    select 1 from public.centre_operating_hours h
    where h.day_of_week = new.day_of_week
      and h.purpose     = 'tutoring'
      and new.starts_at_time >= h.opens_at
      and new.ends_at_time   <= h.closes_at
  ) then
    raise exception
      'The centre is not open for tutoring on ISO day % between % and %',
      new.day_of_week, new.starts_at_time, new.ends_at_time
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger schedule_within_operating_hours
  before insert or update on public.class_schedules
  for each row execute function private.check_schedule_within_hours();

-- Materialised occurrences -------------------------------------------------
create table public.class_sessions (
  id             uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references public.class_groups (id) on delete cascade,
  schedule_id    uuid references public.class_schedules (id) on delete set null,
  session_date   date not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text not null default 'scheduled'
    check (status in ('scheduled', 'held', 'cancelled')),
  tutor_id       uuid references public.tutors (id) on delete set null,
  meeting_url    text,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  unique (class_group_id, session_date, starts_at),
  check (starts_at < ends_at)
);

create index on public.class_sessions (session_date);
create index on public.class_sessions (class_group_id, session_date);

comment on column public.class_sessions.tutor_id is
  'Substitute for this occurrence only. Null means the class group tutor.';
comment on column public.class_sessions.meeting_url is
  'Per session, not per class, so a leaked link expires with the session.';

-- Placement ----------------------------------------------------------------
create table public.class_enrolments (
  id             uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references public.class_groups (id) on delete cascade,
  learner_id     uuid not null references public.learners (id) on delete cascade,
  enrolment_id   uuid not null references public.enrolments (id) on delete cascade,
  joined_on      date not null default current_date,
  left_on        date,
  check (left_on is null or left_on >= joined_on)
);

-- A learner is in a class once at a time.
create unique index class_enrolment_active on public.class_enrolments (class_group_id, learner_id)
  where left_on is null;
create index on public.class_enrolments (learner_id);

-- Placement may not exceed the class capacity.
create or replace function private.check_class_capacity()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_capacity smallint;
  v_taken    integer;
begin
  if new.left_on is not null then return new; end if;

  select capacity into v_capacity
  from public.class_groups where id = new.class_group_id;

  select count(*) into v_taken
  from public.class_enrolments
  where class_group_id = new.class_group_id and left_on is null
    and id is distinct from new.id;

  if v_taken + 1 > v_capacity then
    raise exception 'Class is full (capacity %)', v_capacity
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger class_enrolment_capacity
  before insert or update on public.class_enrolments
  for each row execute function private.check_class_capacity();

-- Attendance (BP section 12, 24) ------------------------------------------
create table public.attendance_records (
  id               uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions (id) on delete cascade,
  learner_id       uuid not null references public.learners (id) on delete cascade,
  status           text not null check (status in ('present', 'absent', 'late', 'excused')),
  marked_by        uuid references public.profiles (id),
  marked_at        timestamptz not null default now(),
  note             text not null default '',
  unique (class_session_id, learner_id)
);

create index on public.attendance_records (learner_id);

-- Sign in / sign out (BP section 22) --------------------------------------
create table public.session_check_ins (
  id               uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions (id) on delete cascade,
  learner_id       uuid not null references public.learners (id) on delete cascade,
  arrived_at       timestamptz not null default now(),
  signed_in_by     uuid references public.profiles (id),
  departed_at      timestamptz,
  collected_by     uuid references public.authorised_collectors (id) on delete set null,
  signed_out_by    uuid references public.profiles (id),
  note             text not null default '',
  unique (class_session_id, learner_id),
  check (departed_at is null or departed_at >= arrived_at),
  check (departed_at is not null or collected_by is null)
);

comment on table public.session_check_ins is
  'Controlled collection. collected_by must be on the learner authorised list.';

-- The collector must be authorised FOR THIS LEARNER and active on the day.
create or replace function private.check_collector_authorised()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
begin
  if new.collected_by is null then return new; end if;

  if not exists (
    select 1 from public.authorised_collectors c
    where c.id = new.collected_by
      and c.learner_id = new.learner_id
      and c.active_from <= coalesce(new.departed_at, now())::date
      and (c.active_to is null or c.active_to >= coalesce(new.departed_at, now())::date)
  ) then
    raise exception 'Collector is not authorised for this learner'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger check_in_collector_authorised
  before insert or update on public.session_check_ins
  for each row execute function private.check_collector_authorised();

alter table public.class_groups       enable row level security;
alter table public.class_group_grades enable row level security;
alter table public.class_schedules    enable row level security;
alter table public.class_sessions     enable row level security;
alter table public.class_enrolments   enable row level security;
alter table public.attendance_records enable row level security;
alter table public.session_check_ins  enable row level security;
