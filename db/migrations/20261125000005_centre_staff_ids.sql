-- Who "the centre" is, when a parent writes to it.
--
-- Parents can't read administrators' profiles or roles, so the message form had
-- no way to address the centre: its "To" list held only tutors. This returns the
-- profile ids (nothing else) of the active administrators, who all receive a
-- message sent to the centre. Deactivated users are banned in auth, see
-- 20261117000002_edit_and_deactivate_users.sql.

create or replace function public.centre_staff_ids()
returns uuid[]
language sql stable security definer set search_path = ''
as $fn$
  select coalesce(array_agg(distinct ur.user_id), '{}')
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  where ur.role in ('admin', 'superadmin')
    and (u.banned_until is null or u.banned_until <= now())
$fn$;

comment on function public.centre_staff_ids() is
  'Profile ids of the active administrators, the recipients of a message sent to the centre.';

revoke execute on function public.centre_staff_ids() from public, anon;
grant execute on function public.centre_staff_ids() to authenticated;
