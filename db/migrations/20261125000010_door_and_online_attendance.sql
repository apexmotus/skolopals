-- Door sign-in/out and online attendance.
-- docs/SPEC-2026-11-door-and-online-attendance.md (approved 2026-11-25).
--
-- In-centre classes: the teaching tutor (or substitute) or an admin signs a
-- learner in and out at the door. Signing in marks the register; signing out
-- records who collected (a listed collector, a guardian, or nobody, with the
-- guardian's permission) and tells the guardians. Learners still signed in 30
-- minutes after their class ends raise one alert.
--
-- Online and hybrid classes: learners join through a tracked link that records
-- the click and returns the meeting URL; the tutor confirms the register.

-- 1. Leaving on their own, only with a guardian's permission ---------------
alter table public.learners
  add column may_leave_alone        boolean not null default false,
  add column may_leave_alone_set_by uuid references public.profiles (id) on delete set null,
  add column may_leave_alone_set_at timestamptz;

comment on column public.learners.may_leave_alone is
  'A guardian allows this learner to leave the centre without being collected. Only a guardian may change it.';

create or replace function private.stamp_leave_alone()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
begin
  if new.may_leave_alone is distinct from old.may_leave_alone then
    if not private.is_guardian_of(new.id) then
      raise exception 'Only a parent or guardian can change whether a learner may leave on their own'
        using errcode = 'check_violation';
    end if;
    new.may_leave_alone_set_by := (select auth.uid());
    new.may_leave_alone_set_at := now();
  end if;
  return new;
end;
$fn$;

create trigger learners_stamp_leave_alone
  before update of may_leave_alone on public.learners
  for each row execute function private.stamp_leave_alone();

-- 2. Who collected: a listed collector, a guardian, or nobody --------------
alter table public.session_check_ins
  add column collected_by_guardian uuid references public.guardians (profile_id) on delete set null,
  add column left_alone            boolean not null default false,
  add column late_alert_sent_at    timestamptz,
  -- Who collected, as a name. Parents and tutors can't read every collector or
  -- guardian record, but should see who took the child.
  add column collected_by_name     text,
  add constraint check_ins_one_collector
    check (num_nonnulls(collected_by, collected_by_guardian) + (case when left_alone then 1 else 0 end) <= 1);

create or replace function private.check_departure()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
begin
  if new.departed_at is null then
    if new.collected_by_guardian is not null or new.left_alone then
      raise exception 'Record who collected only when signing out' using errcode = 'check_violation';
    end if;
    new.collected_by_name := null;
    return new;
  end if;

  if new.collected_by is null and new.collected_by_guardian is null and not new.left_alone then
    raise exception 'Choose who collected the learner' using errcode = 'check_violation';
  end if;
  if new.collected_by_guardian is not null and not exists (
       select 1 from public.learner_guardians lg
       where lg.learner_id = new.learner_id and lg.guardian_id = new.collected_by_guardian) then
    raise exception 'That person is not a guardian of this learner' using errcode = 'check_violation';
  end if;
  if new.left_alone and not exists (
       select 1 from public.learners l where l.id = new.learner_id and l.may_leave_alone) then
    raise exception 'A guardian has not allowed this learner to leave on their own' using errcode = 'check_violation';
  end if;

  new.collected_by_name := case
    when new.left_alone then null
    when new.collected_by is not null then
      (select full_name from public.authorised_collectors where id = new.collected_by)
    else (select full_name from public.profiles where id = new.collected_by_guardian)
  end;
  return new;
end;
$fn$;

create trigger check_in_departure
  before insert or update on public.session_check_ins
  for each row execute function private.check_departure();

-- 3. The teaching tutor runs the door, for in-centre classes only ----------
create or replace function private.runs_door_for(p_session uuid, p_learner uuid)
returns boolean
language sql stable security definer set search_path = ''
as $fn$ select exists (
  select 1
  from public.class_sessions s
  join public.class_groups cg on cg.id = s.class_group_id
  join public.class_enrolments ce on ce.class_group_id = cg.id and ce.learner_id = p_learner and ce.left_on is null
  where s.id = p_session
    and s.status <> 'cancelled'
    and cg.delivery_mode = 'in_centre'
    and coalesce(s.tutor_id, cg.tutor_id) = private.my_tutor_id()) $fn$;

grant execute on function private.runs_door_for(uuid, uuid) to authenticated;

create policy "check_ins: teaching tutor signs in" on public.session_check_ins for insert to authenticated
  with check (private.runs_door_for(class_session_id, learner_id) and signed_in_by = (select auth.uid()));
create policy "check_ins: teaching tutor signs out" on public.session_check_ins for update to authenticated
  using (private.runs_door_for(class_session_id, learner_id))
  with check (private.runs_door_for(class_session_id, learner_id));

-- 4. Signing in marks the register: Present, or Late after 10 minutes -------
-- Never overrides Excused, which the tutor set on purpose.
create or replace function private.mark_register_on_sign_in()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_starts timestamptz;
begin
  select starts_at into v_starts from public.class_sessions where id = new.class_session_id;
  insert into public.attendance_records (class_session_id, learner_id, status, marked_by)
  values (new.class_session_id, new.learner_id,
          case when new.arrived_at > v_starts + interval '10 minutes' then 'late' else 'present' end,
          new.signed_in_by)
  on conflict (class_session_id, learner_id) do update
    set status = excluded.status, marked_by = excluded.marked_by, marked_at = now()
    where public.attendance_records.status <> 'excused';
  return new;
end;
$fn$;

create trigger check_in_marks_register
  after insert on public.session_check_ins
  for each row execute function private.mark_register_on_sign_in();

-- 5. Notifications --------------------------------------------------------
create or replace function private.notify(p_title text, p_body text, p_recipients uuid[])
returns void
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_id uuid;
begin
  if coalesce(array_length(p_recipients, 1), 0) = 0 then return; end if;
  insert into public.notifications (title, body, created_by)
  values (p_title, coalesce(p_body, ''), (select auth.uid()))
  returning id into v_id;
  insert into public.notification_recipients (notification_id, profile_id)
  select v_id, r from (select distinct unnest(p_recipients) as r) x where r is not null
  on conflict do nothing;
end;
$fn$;

revoke execute on function private.notify(text, text, uuid[]) from public, anon, authenticated;

-- Signing out tells the learner's guardians who collected them, and when.
create or replace function private.notify_sign_out()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_first text;
  v_what  text;
  v_when  text := to_char(new.departed_at at time zone 'Africa/Johannesburg', 'HH24:MI');
begin
  if old.departed_at is not null or new.departed_at is null then return new; end if;

  select split_part(full_name, ' ', 1) into v_first from public.learners where id = new.learner_id;
  if new.left_alone then
    v_what := format('%s left the centre on their own at %s.', v_first, v_when);
  elsif new.collected_by is not null then
    select format('%s was collected by %s at %s.', v_first, c.full_name, v_when) into v_what
    from public.authorised_collectors c where c.id = new.collected_by;
  else
    select format('%s was collected by %s at %s.', v_first, p.full_name, v_when) into v_what
    from public.profiles p where p.id = new.collected_by_guardian;
  end if;

  perform private.notify(
    format('%s has been signed out', v_first),
    v_what,
    array(select guardian_id from public.learner_guardians where learner_id = new.learner_id));
  return new;
end;
$fn$;

create trigger check_in_notify_sign_out
  after update of departed_at on public.session_check_ins
  for each row execute function private.notify_sign_out();

-- 6. Late pickups: one alert, 30 minutes after the class ends -------------
-- Runs from the scheduled job (as anon, like process_enrolment_offers) and
-- whenever staff open the door screen. Idempotent: each check-in alerts once.
create or replace function private.alert_late_pickups()
returns integer
language plpgsql security definer set search_path = ''
as $fn$
declare
  r        record;
  v_admins uuid[];
  v_count  integer := 0;
begin
  select coalesce(array_agg(distinct ur.user_id), '{}') into v_admins
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  where ur.role in ('admin', 'superadmin')
    and (u.banned_until is null or u.banned_until <= now());

  for r in
    select ci.id, ci.learner_id, l.full_name, s.ends_at, cg.name as class_name
    from public.session_check_ins ci
    join public.class_sessions s on s.id = ci.class_session_id
    join public.class_groups cg on cg.id = s.class_group_id
    join public.learners l on l.id = ci.learner_id
    where ci.departed_at is null
      and ci.late_alert_sent_at is null
      and s.ends_at + interval '30 minutes' <= now()
      and s.ends_at > now() - interval '1 day'
    for update of ci skip locked
  loop
    perform private.notify(
      format('%s is still at the centre', split_part(r.full_name, ' ', 1)),
      format('%s is still signed in. %s ended at %s.', r.full_name, r.class_name,
             to_char(r.ends_at at time zone 'Africa/Johannesburg', 'HH24:MI')),
      v_admins || array(select guardian_id from public.learner_guardians where learner_id = r.learner_id));
    update public.session_check_ins set late_alert_sent_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$fn$;

grant execute on function private.alert_late_pickups() to anon, authenticated;

-- The door screen's entry point: staff only.
create or replace function public.alert_late_pickups()
returns integer
language plpgsql security definer set search_path = ''
as $fn$
begin
  if not (private.is_admin() or private.my_tutor_id() is not null) then
    raise exception 'Only centre staff can run this' using errcode = '42501';
  end if;
  return private.alert_late_pickups();
end;
$fn$;

revoke execute on function public.alert_late_pickups() from public, anon;
grant execute on function public.alert_late_pickups() to authenticated;

-- 7. Online joins ----------------------------------------------------------
create table public.session_joins (
  id               uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions (id) on delete cascade,
  learner_id       uuid not null references public.learners (id) on delete cascade,
  joined_by        uuid references public.profiles (id) on delete set null,
  joined_at        timestamptz not null default now()
);

comment on table public.session_joins is
  'A click on the Skolopals join link for an online or hybrid session. Shows the link was opened, not '
  'that the learner stayed: the tutor confirms the register.';

create index on public.session_joins (class_session_id);
create index on public.session_joins (learner_id);

alter table public.session_joins enable row level security;
revoke all on public.session_joins from anon, authenticated;
grant select on public.session_joins to authenticated;

create policy "joins: read" on public.session_joins for select to authenticated
  using (private.is_admin()
      or private.is_guardian_of(learner_id)
      or private.is_learner_self(learner_id)
      or exists (select 1 from public.class_sessions s
                 join public.class_groups cg on cg.id = s.class_group_id
                 where s.id = class_session_id
                   and coalesce(s.tutor_id, cg.tutor_id) = private.my_tutor_id()));

-- Records the click and hands back the meeting link. The only way to write a join.
create or replace function public.join_session(p_session_id uuid, p_learner_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_session record;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to join' using errcode = 'P0001';
  end if;
  if not (private.is_guardian_of(p_learner_id) or private.is_learner_self(p_learner_id)) then
    raise exception 'You can only join for your own child' using errcode = 'P0001';
  end if;

  select s.starts_at, s.ends_at, s.status, s.meeting_url, cg.delivery_mode, cg.id as class_id
    into v_session
  from public.class_sessions s
  join public.class_groups cg on cg.id = s.class_group_id
  where s.id = p_session_id;

  if not found then
    raise exception 'That session does not exist' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.class_enrolments ce
                 where ce.class_group_id = v_session.class_id
                   and ce.learner_id = p_learner_id and ce.left_on is null) then
    raise exception 'This learner is not in that class' using errcode = 'P0001';
  end if;
  if v_session.delivery_mode = 'in_centre' then
    raise exception 'This class is at the centre, not online' using errcode = 'P0001';
  end if;
  if v_session.status = 'cancelled' then
    raise exception 'This session was cancelled' using errcode = 'P0001';
  end if;
  if now() < v_session.starts_at - interval '15 minutes' then
    raise exception 'The link opens 15 minutes before the class starts' using errcode = 'P0001';
  end if;
  if now() > v_session.ends_at then
    raise exception 'This session has ended' using errcode = 'P0001';
  end if;
  if coalesce(v_session.meeting_url, '') = '' then
    raise exception 'The tutor has not added the meeting link yet' using errcode = 'P0001';
  end if;

  insert into public.session_joins (class_session_id, learner_id, joined_by)
  values (p_session_id, p_learner_id, (select auth.uid()));
  return v_session.meeting_url;
end;
$fn$;

revoke execute on function public.join_session(uuid, uuid) from public, anon;
grant execute on function public.join_session(uuid, uuid) to authenticated;

-- 8. Who may collect, for the door screen -----------------------------------
-- Tutors can't read guardians' profiles or the collector list (both guardian /
-- admin only). The door needs exactly this much, for one session at a time,
-- and only for whoever runs that session's door.
create or replace function public.door_contacts(p_session_id uuid)
returns table (
  learner_id   uuid,
  kind         text,
  id           uuid,
  full_name    text,
  relationship text,
  phone        text,
  id_last4     text
)
language sql stable security definer set search_path = ''
as $fn$
  with placed as (
    select ce.learner_id
    from public.class_sessions s
    join public.class_enrolments ce on ce.class_group_id = s.class_group_id and ce.left_on is null
    where s.id = p_session_id
      and (private.is_admin() or private.runs_door_for(p_session_id, ce.learner_id))
  )
  select lg.learner_id, 'guardian', p.id, p.full_name, lg.relationship, coalesce(p.phone, ''), null::text
  from placed
  join public.learner_guardians lg on lg.learner_id = placed.learner_id
  join public.profiles p on p.id = lg.guardian_id
  union all
  select c.learner_id, 'collector', c.id, c.full_name, c.relationship, c.phone, c.id_number_last4
  from placed
  join public.authorised_collectors c on c.learner_id = placed.learner_id
  where c.active_from <= (now() at time zone 'Africa/Johannesburg')::date
    and (c.active_to is null or c.active_to >= (now() at time zone 'Africa/Johannesburg')::date)
$fn$;

revoke execute on function public.door_contacts(uuid) from public, anon;
grant execute on function public.door_contacts(uuid) to authenticated;
