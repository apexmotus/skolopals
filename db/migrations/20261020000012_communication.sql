-- Messaging, announcements, enquiries, resources and tutor reviews.
--
-- Threads rather than sender/recipient pairs: a conversation about a learner
-- typically involves a parent, a tutor and the centre manager. Read state is
-- per participant, which a single messages.read_at column cannot express.

create table public.message_threads (
  id         uuid primary key default gen_random_uuid(),
  subject    text not null default '',
  learner_id uuid references public.learners (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);

create table public.thread_participants (
  thread_id  uuid not null references public.message_threads (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (thread_id, profile_id)
);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.message_threads (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index on public.messages (thread_id, created_at);

-- Read state belongs to the (message, person) pair, not the message.
create table public.message_reads (
  message_id uuid not null references public.messages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, profile_id)
);

-- Announcements ------------------------------------------------------------
-- The old notifications table had user_id XOR audience, a disjunctive key
-- nothing enforced, plus one read_at for a broadcast to many people.
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.notification_recipients (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  read_at         timestamptz,
  primary key (notification_id, profile_id)
);

create index on public.notification_recipients (profile_id) where read_at is null;

-- Enquiries (BR-55, feeds the enquiry KPI) --------------------------------
create table public.contact_enquiries (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  email               text not null default '',
  phone               text not null default '',
  topic               text not null default '',
  message             text not null,
  source              text not null default 'website'
    check (source in ('website', 'whatsapp', 'facebook', 'walk_in', 'phone', 'referral', 'flyer', 'other')),
  status              text not null default 'new'
    check (status in ('new', 'contacted', 'enrolled', 'closed')),
  handled_by          uuid references public.profiles (id),
  handled_at          timestamptz,
  converted_learner_id uuid references public.learners (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index on public.contact_enquiries (status, created_at desc);

-- Resources ----------------------------------------------------------------
create table public.resources (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  subject_code text references public.subjects (code),
  url          text not null default '',
  storage_path text not null default '',
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

-- The old resources table used two nullable columns to encode four meanings.
-- Audience is its own relation with an explicit, checked discriminator.
create table public.resource_audiences (
  id             uuid primary key default gen_random_uuid(),
  resource_id    uuid not null references public.resources (id) on delete cascade,
  audience_type  text not null check (audience_type in ('learner', 'class_group', 'grade', 'all')),
  learner_id     uuid references public.learners (id) on delete cascade,
  class_group_id uuid references public.class_groups (id) on delete cascade,
  grade_code     text references public.grades (code),
  -- Exactly the column matching the discriminator is set.
  check (
    (audience_type = 'learner'     and learner_id is not null and class_group_id is null and grade_code is null) or
    (audience_type = 'class_group' and class_group_id is not null and learner_id is null and grade_code is null) or
    (audience_type = 'grade'       and grade_code is not null and learner_id is null and class_group_id is null) or
    (audience_type = 'all'         and learner_id is null and class_group_id is null and grade_code is null)
  )
);

create index on public.resource_audiences (resource_id);

-- Tutor reviews (BR-25, moderated) ----------------------------------------
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null references public.tutors (id) on delete cascade,
  guardian_id  uuid not null references public.guardians (profile_id) on delete cascade,
  learner_id   uuid references public.learners (id) on delete set null,
  rating       smallint not null check (rating between 1 and 5),
  comment      text not null default '',
  status       text not null default 'pending'
    check (status in ('pending', 'published', 'rejected')),
  created_at   timestamptz not null default now(),
  published_at timestamptz,
  moderated_by uuid references public.profiles (id),
  unique (tutor_id, guardian_id, learner_id)
);

create index on public.reviews (tutor_id) where status = 'published';

-- A rating is DERIVED from published reviews. The old schema kept rating and
-- review_count as columns on tutors, maintained by trigger - two places for
-- one fact. If this ever becomes slow, make it a materialised view.
create or replace view public.tutor_rating_summary with (security_invoker = true) as
select t.id                                              as tutor_id,
       count(r.id)                                       as review_count,
       round(coalesce(avg(r.rating), 0)::numeric, 1)     as rating
from public.tutors t
left join public.reviews r on r.tutor_id = t.id and r.status = 'published'
group by t.id;

comment on view public.tutor_rating_summary is
  'Derived from published reviews. Replaces the denormalised tutors.rating '
  'and tutors.review_count columns.';

alter table public.message_threads         enable row level security;
alter table public.thread_participants     enable row level security;
alter table public.messages                enable row level security;
alter table public.message_reads           enable row level security;
alter table public.notifications           enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.contact_enquiries       enable row level security;
alter table public.resources               enable row level security;
alter table public.resource_audiences      enable row level security;
alter table public.reviews                 enable row level security;
