-- Admin user invitations, first_name / last_name profile fields, and
-- superadmin vs admin role hierarchy.
--
-- Business rules:
--   * Only admins and superadmins can access admin functionality.
--   * Superadmin inherits all admin permissions via private.is_admin().
--   * Regular admins can only assign non-admin roles ('tutor', 'parent', 'learner').
--   * Only superadmins can assign the 'admin' role.
--   * Neither admins nor superadmins can assign 'superadmin' through application writes.
--   * Inviting a 'tutor' immediately creates a default public.tutors staff row.

-- 1. Add first_name and last_name to public.profiles -----------------------
alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name  text not null default '';

update public.profiles
   set first_name = case
         when position(' ' in trim(full_name)) > 0
           then split_part(trim(full_name), ' ', 1)
         else trim(full_name)
       end,
       last_name = case
         when position(' ' in trim(full_name)) > 0
           then ltrim(substring(trim(full_name) from position(' ' in trim(full_name)) + 1))
         else ''
       end
 where first_name = '' and last_name = '' and trim(full_name) <> '';

-- 2. Update RLS role helpers -----------------------------------------------
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $fn$ select private.has_role('admin') or private.has_role('superadmin') $fn$;

create or replace function private.is_superadmin()
returns boolean language sql stable security definer set search_path = ''
as $fn$ select private.has_role('superadmin') $fn$;

revoke execute on function private.is_superadmin() from public;
grant execute on function private.is_superadmin() to anon, authenticated;

-- 3. Restrict public.user_roles write policies -----------------------------
drop policy if exists "user_roles: admin write" on public.user_roles;
drop policy if exists "user_roles: admin write non-admin" on public.user_roles;
drop policy if exists "user_roles: superadmin write admin" on public.user_roles;

-- Regular admins and superadmins may grant/update/delete non-admin roles.
create policy "user_roles: admin write non-admin" on public.user_roles
  for all to authenticated
  using (private.is_admin() and role in ('parent', 'learner', 'tutor'))
  with check (private.is_admin() and role in ('parent', 'learner', 'tutor'));

-- Only superadmins may grant/update/delete the 'admin' role.
-- Neither policy permits 'superadmin', preventing privilege escalation via API/PostgREST.
create policy "user_roles: superadmin write admin" on public.user_roles
  for all to authenticated
  using (private.is_superadmin() and role = 'admin')
  with check (private.is_superadmin() and role = 'admin');

-- 4. Update handle_new_user trigger to populate first_name & last_name -----
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_first_name text;
  v_last_name  text;
  v_full_name  text;
begin
  v_first_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), '');
  v_last_name  := coalesce(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), '');
  v_full_name  := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(v_first_name || ' ' || v_last_name), ''),
    split_part(new.email, '@', 1)
  );

  if v_first_name = '' and v_last_name = '' and v_full_name <> '' then
    if position(' ' in v_full_name) > 0 then
      v_first_name := split_part(v_full_name, ' ', 1);
      v_last_name  := ltrim(substring(v_full_name from position(' ' in v_full_name) + 1));
    else
      v_first_name := v_full_name;
    end if;
  end if;

  insert into public.profiles (id, first_name, last_name, full_name, phone)
  values (
    new.id,
    v_first_name,
    v_last_name,
    v_full_name,
    new.raw_user_meta_data ->> 'phone'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'parent');
  insert into public.guardians (profile_id) values (new.id);
  return new;
end;
$fn$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

-- 5. Provision an invited user's profile, role, and tutor/guardian record --
create or replace function public.configure_invited_user(
  p_user_id    uuid,
  p_first_name text,
  p_last_name  text,
  p_role       public.app_role
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_first     text := trim(coalesce(p_first_name, ''));
  v_last      text := trim(coalesce(p_last_name, ''));
  v_full      text := trim(v_first || ' ' || v_last);
  v_email     text;
  v_base_slug text;
  v_slug      text;
  v_suffix    integer := 1;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  if p_role = 'superadmin' then
    raise exception 'Super administrator role cannot be assigned' using errcode = 'P0001';
  end if;

  if p_role = 'admin' and not (select private.is_superadmin()) then
    raise exception 'Only super administrators can create administrator accounts' using errcode = 'P0001';
  end if;

  if v_first = '' or v_last = '' then
    raise exception 'First name and last name are required' using errcode = 'check_violation';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'Invited user account not found' using errcode = 'P0002';
  end if;

  update public.profiles
     set first_name = v_first,
         last_name  = v_last,
         full_name  = v_full
   where id = p_user_id;

  -- Replace the default self-signup 'parent' role if a different role was invited.
  if p_role <> 'parent' then
    delete from public.user_roles where user_id = p_user_id and role = 'parent';
    delete from public.guardians
     where profile_id = p_user_id
       and not exists (select 1 from public.learner_guardians lg where lg.guardian_id = p_user_id);
  else
    insert into public.guardians (profile_id)
    values (p_user_id)
    on conflict (profile_id) do nothing;
  end if;

  insert into public.user_roles (user_id, role)
  values (p_user_id, p_role)
  on conflict (user_id, role) do nothing;

  -- When invited as a tutor, immediately create a default public.tutors staff row.
  if p_role = 'tutor' and not exists (select 1 from public.tutors where profile_id = p_user_id) then
    v_base_slug := regexp_replace(lower(v_full), '[^a-z0-9]+', '-', 'g');
    v_base_slug := trim(both '-' from v_base_slug);
    if v_base_slug = '' then
      v_base_slug := regexp_replace(lower(split_part(v_email, '@', 1)), '[^a-z0-9]+', '-', 'g');
      v_base_slug := trim(both '-' from v_base_slug);
    end if;
    if v_base_slug = '' then
      v_base_slug := 'tutor';
    end if;

    v_slug := v_base_slug;
    while exists (select 1 from public.tutors where slug = v_slug) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '-' || v_suffix::text;
    end loop;

    insert into public.tutors (profile_id, slug, employment_type, headline, status)
    values (p_user_id, v_slug, 'sessional', '', 'active');
  end if;

  return p_user_id;
end;
$fn$;

revoke execute on function public.configure_invited_user(uuid, text, text, public.app_role) from public, anon;
grant execute on function public.configure_invited_user(uuid, text, text, public.app_role) to authenticated;

-- 6. Admin user directory read helpers (joins auth.users email safely) -----
create or replace function public.list_users_for_admin(
  p_search text default null,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id          uuid,
  first_name  text,
  last_name   text,
  full_name   text,
  email       text,
  phone       text,
  roles       text[],
  created_at  timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  return query
  with filtered as (
    select p.id,
           p.first_name,
           p.last_name,
           p.full_name,
           coalesce(u.email, '') as email,
           p.phone,
           coalesce(
             array(
               select ur.role::text
                 from public.user_roles ur
                where ur.user_id = p.id
                order by ur.role::text
             ),
             array[]::text[]
           ) as roles,
           p.created_at
      from public.profiles p
      join auth.users u on u.id = p.id
     where (
       p_search is null
       or trim(p_search) = ''
       or p.full_name ilike '%' || trim(p_search) || '%'
       or u.email ilike '%' || trim(p_search) || '%'
     )
  )
  select f.id,
         f.first_name,
         f.last_name,
         f.full_name,
         f.email,
         f.phone,
         f.roles,
         f.created_at,
         count(*) over () as total_count
    from filtered f
   order by f.created_at desc, f.id asc
   limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$fn$;

revoke execute on function public.list_users_for_admin(text, integer, integer) from public, anon;
grant execute on function public.list_users_for_admin(text, integer, integer) to authenticated;

create or replace function public.get_user_for_admin(
  p_user_id uuid
)
returns table (
  id         uuid,
  first_name text,
  last_name  text,
  full_name  text,
  email      text,
  phone      text,
  roles      text[],
  created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  return query
  select p.id,
         p.first_name,
         p.last_name,
         p.full_name,
         coalesce(u.email, '') as email,
         p.phone,
         coalesce(
           array(
             select ur.role::text
               from public.user_roles ur
              where ur.user_id = p.id
              order by ur.role::text
           ),
           array[]::text[]
         ) as roles,
         p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = p_user_id;
end;
$fn$;

revoke execute on function public.get_user_for_admin(uuid) from public, anon;
grant execute on function public.get_user_for_admin(uuid) to authenticated;
