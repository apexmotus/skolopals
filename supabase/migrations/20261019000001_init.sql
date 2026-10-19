-- Skolopals initial schema
-- Roles: student (incl. parents), tutor, admin.
-- Payment model: student pays Skolopals; 40% platform fee retained, 60% paid to tutor weekly.

create type public.user_role as enum ('student', 'tutor', 'admin');
create type public.tutor_status as enum ('pending', 'approved', 'declined', 'more_info', 'suspended');
create type public.booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'declined', 'refunded');

-- Profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'student',
  full_name text not null default '',
  grade_level text,
  created_at timestamptz not null default now()
);

-- Tutors (public marketplace listing; profile_id null for seeded demo tutors)
create table public.tutors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  slug text not null unique,
  full_name text not null,
  headline text not null default '',
  bio text not null default '',
  qualifications text not null default '',
  subjects text[] not null default '{}',
  topics text[] not null default '{}',
  grades text not null default '',
  languages text[] not null default '{English}',
  hourly_rate_cents integer not null check (hourly_rate_cents > 0),
  rating numeric(2,1) not null default 0,
  review_count integer not null default 0,
  photo_url text,
  status public.tutor_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors (id) on delete cascade,
  starts_at timestamptz not null,
  is_booked boolean not null default false,
  unique (tutor_id, starts_at)
);

-- Tutor applications --------------------------------------------------------
create table public.tutor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  email text not null,
  subjects text not null,
  grades text not null default '',
  qualifications text not null default '',
  experience text not null default '',
  documents text[] not null default '{}',
  status public.tutor_status not null default 'pending',
  admin_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Bookings & payments -------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  tutor_id uuid not null references public.tutors (id) on delete restrict,
  slot_id uuid references public.availability_slots (id) on delete set null,
  subject text not null,
  learning_goal text not null default '',
  starts_at timestamptz not null,
  duration_minutes integer not null default 60,
  format text not null default 'Online',
  price_cents integer not null,
  status public.booking_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount_cents integer not null,
  platform_fee_cents integer generated always as (round(amount_cents * 0.40)::integer) stored,
  tutor_payout_cents integer generated always as (amount_cents - round(amount_cents * 0.40)::integer) stored,
  status public.payment_status not null default 'pending',
  card_last4 text,
  created_at timestamptz not null default now()
);

-- Messaging, reviews, progress, resources, notifications --------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete set null,
  booking_id uuid unique references public.bookings (id) on delete set null,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create table public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  tutor_id uuid not null references public.tutors (id) on delete cascade,
  subject text not null,
  score_label text not null,
  trend text not null default '',
  summary text not null default '',
  created_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid references public.tutors (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  title text not null,
  subject text not null default '',
  url text not null default '',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  audience public.user_role,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text not null default '',
  message text not null,
  created_at timestamptz not null default now()
);

create index on public.bookings (student_id, starts_at);
create index on public.bookings (tutor_id, starts_at);
create index on public.availability_slots (tutor_id, starts_at);
create index on public.messages (recipient_id, created_at);
create index on public.messages (sender_id, created_at);
create index on public.reviews (tutor_id);
create index on public.payments (booking_id);
create index on public.progress_reports (student_id);
create index on public.resources (student_id);
create index on public.notifications (user_id);
create index on public.tutor_applications (user_id);

-- Helpers -------------------------------------------------------------------
create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role = 'admin' from public.profiles where id = (select auth.uid())), false) $$;

create or replace function public.my_tutor_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select id from public.tutors where profile_id = (select auth.uid()) $$;

-- New auth user -> profile. Only student/tutor may be self-selected.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    case when requested = 'tutor' then 'tutor'::public.user_role else 'student'::public.user_role end,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row level security --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tutors enable row level security;
alter table public.availability_slots enable row level security;
alter table public.tutor_applications enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.progress_reports enable row level security;
alter table public.resources enable row level security;
alter table public.notifications enable row level security;
alter table public.contact_messages enable row level security;

-- profiles
create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: read counterparts" on public.profiles for select to authenticated
  using (exists (
    select 1 from public.bookings b join public.tutors t on t.id = b.tutor_id
    where (b.student_id = profiles.id and t.profile_id = (select auth.uid()))
       or (t.profile_id = profiles.id and b.student_id = (select auth.uid()))
  ));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select public.current_role()));

-- tutors
create policy "tutors: public approved" on public.tutors for select to anon, authenticated
  using (status = 'approved' or profile_id = (select auth.uid()) or (select public.is_admin()));
create policy "tutors: owner update" on public.tutors for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and status = (select t.status from public.tutors t where t.id = tutors.id));
create policy "tutors: admin all" on public.tutors for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- availability
create policy "slots: public read" on public.availability_slots for select to anon, authenticated using (true);
create policy "slots: tutor manage" on public.availability_slots for all to authenticated
  using (tutor_id = (select public.my_tutor_id())) with check (tutor_id = (select public.my_tutor_id()));

-- applications
create policy "applications: anyone submit" on public.tutor_applications for insert to anon, authenticated
  with check (status = 'pending' and (user_id is null or user_id = (select auth.uid())));
create policy "applications: own read" on public.tutor_applications for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "applications: own resubmit" on public.tutor_applications for update to authenticated
  using (user_id = (select auth.uid()) and status = 'more_info')
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy "applications: admin update" on public.tutor_applications for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- bookings
create policy "bookings: participants read" on public.bookings for select to authenticated
  using (student_id = (select auth.uid()) or tutor_id = (select public.my_tutor_id()) or (select public.is_admin()));
create policy "bookings: participants update" on public.bookings for update to authenticated
  using (student_id = (select auth.uid()) or tutor_id = (select public.my_tutor_id()) or (select public.is_admin()));

-- payments
create policy "payments: participants read" on public.payments for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id
    and (b.student_id = (select auth.uid()) or b.tutor_id = (select public.my_tutor_id()) or (select public.is_admin()))));

-- messages
create policy "messages: participants read" on public.messages for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "messages: send as self" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()));
create policy "messages: recipient mark read" on public.messages for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- reviews
create policy "reviews: public read" on public.reviews for select to anon, authenticated using (true);
create policy "reviews: student write" on public.reviews for insert to authenticated
  with check (student_id = (select auth.uid()));

-- progress reports
create policy "reports: participants read" on public.progress_reports for select to authenticated
  using (student_id = (select auth.uid()) or tutor_id = (select public.my_tutor_id()) or (select public.is_admin()));
create policy "reports: tutor write" on public.progress_reports for insert to authenticated
  with check (tutor_id = (select public.my_tutor_id()));

-- resources
create policy "resources: participants read" on public.resources for select to authenticated
  using (student_id = (select auth.uid()) or student_id is null or tutor_id = (select public.my_tutor_id()));
create policy "resources: tutor write" on public.resources for insert to authenticated
  with check (tutor_id = (select public.my_tutor_id()));

-- notifications
create policy "notifications: own read" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or audience = (select public.current_role()));
create policy "notifications: own update" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- contact
create policy "contact: anyone submit" on public.contact_messages for insert to anon, authenticated with check (true);
create policy "contact: admin read" on public.contact_messages for select to authenticated using ((select public.is_admin()));

-- Keep tutor rating aggregates in sync with reviews
create or replace function public.refresh_tutor_rating()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.tutors t set
    rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.tutor_id = t.id), 0),
    review_count = (select count(*) from public.reviews r where r.tutor_id = t.id)
  where t.id = coalesce(new.tutor_id, old.tutor_id);
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_tutor_rating();
