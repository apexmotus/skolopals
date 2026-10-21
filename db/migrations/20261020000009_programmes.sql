-- Holiday and Saturday programmes. BP sections 5 and 23.
-- Priced per programme (R350-R750), so price lives here rather than in
-- package_prices: each programme is its own product with its own dates.

create table public.programmes (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text not null default '',
  programme_type text not null check (programme_type in ('holiday', 'saturday', 'exam_prep')),
  starts_on      date not null,
  ends_on        date not null,
  capacity       smallint not null check (capacity > 0),
  price_cents    integer not null check (price_cents >= 0),
  delivery_mode  text not null check (delivery_mode in ('in_centre', 'online', 'hybrid')),
  room_id        uuid references public.rooms (id) on delete set null,
  is_published   boolean not null default false,
  created_at     timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (delivery_mode = 'online' or room_id is not null)
);

create table public.programme_sessions (
  id           uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes (id) on delete cascade,
  session_date date not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  tutor_id     uuid references public.tutors (id) on delete set null,
  status       text not null default 'scheduled'
    check (status in ('scheduled', 'held', 'cancelled')),
  meeting_url  text,
  notes        text not null default '',
  unique (programme_id, session_date, starts_at),
  check (starts_at < ends_at)
);

create table public.programme_enrolments (
  id           uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes (id) on delete cascade,
  learner_id   uuid not null references public.learners (id) on delete cascade,
  status       text not null default 'booked'
    check (status in ('booked', 'cancelled')),
  booked_at    timestamptz not null default now(),
  unique (programme_id, learner_id)
);

create index on public.programme_enrolments (learner_id);

-- Attendance for programme sessions.
--
-- Deliberately a separate table from attendance_records rather than a
-- polymorphic session reference. A single attendance table would need either
-- a nullable FK pair (two columns, exactly one set - a disjunctive key) or a
-- session supertype that class_sessions and programme_sessions both inherit.
-- Both cost more than the duplication, and real foreign keys are worth
-- keeping. v_attendance_rate unions the two.
create table public.programme_attendance_records (
  id                   uuid primary key default gen_random_uuid(),
  programme_session_id uuid not null references public.programme_sessions (id) on delete cascade,
  learner_id           uuid not null references public.learners (id) on delete cascade,
  status               text not null check (status in ('present', 'absent', 'late', 'excused')),
  marked_by            uuid references public.profiles (id),
  marked_at            timestamptz not null default now(),
  note                 text not null default '',
  unique (programme_session_id, learner_id)
);

create or replace function private.check_programme_capacity()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare v_capacity smallint; v_taken integer;
begin
  if new.status = 'cancelled' then return new; end if;
  select capacity into v_capacity from public.programmes where id = new.programme_id;
  select count(*) into v_taken from public.programme_enrolments
   where programme_id = new.programme_id and status = 'booked'
     and id is distinct from new.id;
  if v_taken + 1 > v_capacity then
    raise exception 'Programme is full (capacity %)', v_capacity
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger programme_enrolment_capacity
  before insert or update on public.programme_enrolments
  for each row execute function private.check_programme_capacity();

alter table public.programmes                    enable row level security;
alter table public.programme_sessions            enable row level security;
alter table public.programme_enrolments          enable row level security;
alter table public.programme_attendance_records  enable row level security;
