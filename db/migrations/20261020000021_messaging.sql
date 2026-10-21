-- Starting a conversation.
--
-- A thread needs its participants to exist before anyone can post, and the
-- RLS policy on messages requires the sender to already be a participant.
-- Creating the thread, adding both sides and posting the first message is
-- therefore one operation, not three.

create or replace function public.start_thread(
  p_subject       text,
  p_body          text,
  p_participants  uuid[],
  p_learner_id    uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_me     uuid := (select auth.uid());
  v_thread uuid;
  v_person uuid;
begin
  if v_me is null then
    raise exception 'Not signed in' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_body), '') = '' then
    raise exception 'Write a message first' using errcode = 'check_violation';
  end if;

  -- You may only open a thread about a learner you are entitled to see.
  if p_learner_id is not null and not (select private.can_view_learner(p_learner_id)) then
    raise exception 'You cannot start a conversation about that learner' using errcode = 'P0001';
  end if;

  insert into public.message_threads (subject, learner_id, created_by)
  values (coalesce(nullif(trim(p_subject), ''), 'Message'), p_learner_id, v_me)
  returning id into v_thread;

  insert into public.thread_participants (thread_id, profile_id) values (v_thread, v_me);
  foreach v_person in array coalesce(p_participants, '{}') loop
    if v_person <> v_me then
      insert into public.thread_participants (thread_id, profile_id) values (v_thread, v_person)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.messages (thread_id, sender_id, body) values (v_thread, v_me, trim(p_body));

  return v_thread;
end;
$fn$;

revoke execute on function public.start_thread(text, text, uuid[], uuid) from public, anon;
grant execute on function public.start_thread(text, text, uuid[], uuid) to authenticated;

-- Mark everything in a thread as read by the caller.
create or replace function public.mark_thread_read(p_thread_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := (select auth.uid()); v_count integer;
begin
  if not (select private.in_thread(p_thread_id)) then
    raise exception 'Not a participant in that conversation' using errcode = 'P0001';
  end if;

  with marked as (
    insert into public.message_reads (message_id, profile_id)
    select m.id, v_me from public.messages m
    where m.thread_id = p_thread_id and m.sender_id <> v_me
    on conflict (message_id, profile_id) do nothing
    returning 1
  )
  select count(*) into v_count from marked;

  return v_count;
end;
$fn$;

revoke execute on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- Threads the caller is in, with the last message and their unread count.
create or replace view public.v_my_threads with (security_invoker = true) as
select t.id,
       t.subject,
       t.learner_id,
       l.full_name                                   as learner_name,
       t.created_at,
       (select max(m.created_at) from public.messages m where m.thread_id = t.id) as last_message_at,
       (select m.body from public.messages m where m.thread_id = t.id
         order by m.created_at desc limit 1)          as last_message,
       (select count(*) from public.messages m
         where m.thread_id = t.id
           and m.sender_id <> (select auth.uid())
           and not exists (select 1 from public.message_reads r
                           where r.message_id = m.id and r.profile_id = (select auth.uid())))
                                                      as unread_count
from public.message_threads t
left join public.learners l on l.id = t.learner_id;

comment on view public.v_my_threads is
  'Conversation list. Unread is counted per participant, which a single '
  'read_at column on messages could not express.';

grant select on public.v_my_threads to authenticated;
