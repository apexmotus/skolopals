-- Give existing auth accounts a profile under the new schema.
--
-- `handle_new_user` only fires on INSERT into auth.users, so anyone who signed
-- up before this schema existed has an account they can still log in with and
-- no profile to log in to. getSession() returns null without a profile, so the
-- app would treat them as signed out for ever.
--
-- Dropping and rebuilding `public` does not touch `auth`, so those accounts
-- survive a redeploy; this is what reconnects them.
--
-- A no-op on a fresh database, where auth.users is empty.

insert into public.profiles (id, full_name, phone, created_at)
select u.id,
       coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)),
       u.raw_user_meta_data ->> 'phone',
       u.created_at
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Everyone who self-registered is a parent or guardian. Roles that the centre
-- grants - tutor, admin - are assigned deliberately, never inferred from the
-- old schema's self-selected sign-up role.
insert into public.user_roles (user_id, role)
select p.id, 'parent'
from public.profiles p
where not exists (select 1 from public.user_roles r where r.user_id = p.id)
on conflict do nothing;

insert into public.guardians (profile_id)
select p.id
from public.profiles p
join public.user_roles r on r.user_id = p.id and r.role = 'parent'
where not exists (select 1 from public.guardians g where g.profile_id = p.id)
on conflict do nothing;
