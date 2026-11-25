-- Names of the people in a conversation, for everyone in it.
--
-- profiles is readable only by its owner and by admins (plus active tutors,
-- 20261110000001). So a tutor reading a thread from an administrator, or a
-- parent reading one an administrator joined, got no sender name and the
-- portal showed "Someone". This returns the name only, never the phone
-- number, and only for a thread the caller is part of.

create or replace function public.thread_people(p_thread_id uuid)
returns table (profile_id uuid, full_name text)
language sql stable security definer set search_path = ''
as $fn$
  select p.id, p.full_name
  from public.profiles p
  where (private.in_thread(p_thread_id) or private.is_admin())
    and (exists (select 1 from public.thread_participants tp
                 where tp.thread_id = p_thread_id and tp.profile_id = p.id)
         -- A sender who has since left the thread still signed their messages.
         or exists (select 1 from public.messages m
                    where m.thread_id = p_thread_id and m.sender_id = p.id))
$fn$;

comment on function public.thread_people(uuid) is
  'Names (not contact details) of everyone in a thread, for the people in it.';

revoke execute on function public.thread_people(uuid) from public, anon;
grant execute on function public.thread_people(uuid) to authenticated;
