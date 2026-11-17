-- Admin user management: edit name / roles, and expose active state.
--
-- Deactivation itself is a Supabase auth ban (auth.users.banned_until), applied by the API
-- through the admin client; these functions only report it. Business rules:
--   * Admins and superadmins may edit users; only superadmins may touch an admin / superadmin
--     account or grant / revoke the 'admin' role.
--   * The 'superadmin' role is never granted or revoked here.
--   * A user must keep at least one role.

-- 1. Directory helpers now report is_active ---------------------------------
-- Return types change, so the functions have to be dropped first.
drop function if exists public.list_users_for_admin(text, integer, integer);
drop function if exists public.get_user_for_admin(uuid);

create function public.list_users_for_admin(
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
  is_active   boolean,
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
           coalesce(u.email, '')::text as email,
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
           (u.banned_until is null or u.banned_until <= now()) as is_active,
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
  select f.id, f.first_name, f.last_name, f.full_name, f.email, f.phone,
         f.roles, f.is_active, f.created_at,
         count(*) over () as total_count
    from filtered f
   order by f.created_at desc, f.id asc
   limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$fn$;

create function public.get_user_for_admin(p_user_id uuid)
returns table (
  id         uuid,
  first_name text,
  last_name  text,
  full_name  text,
  email      text,
  phone      text,
  roles      text[],
  is_active  boolean,
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
         coalesce(u.email, '')::text as email,
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
         (u.banned_until is null or u.banned_until <= now()) as is_active,
         p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = p_user_id;
end;
$fn$;

revoke execute on function public.list_users_for_admin(text, integer, integer) from public, anon;
grant execute on function public.list_users_for_admin(text, integer, integer) to authenticated;
revoke execute on function public.get_user_for_admin(uuid) from public, anon;
grant execute on function public.get_user_for_admin(uuid) to authenticated;

-- 2. Edit a user's name and roles -------------------------------------------
create or replace function public.update_user_for_admin(
  p_user_id    uuid,
  p_first_name text,
  p_last_name  text,
  p_roles      public.app_role[]
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_first     text := trim(coalesce(p_first_name, ''));
  v_last      text := trim(coalesce(p_last_name, ''));
  v_full      text := trim(v_first || ' ' || v_last);
  v_is_super  boolean := (select private.is_superadmin());
  v_target_is_admin boolean;
  v_wants_admin     boolean;
  v_email     text;
  v_base_slug text;
  v_slug      text;
  v_suffix    integer := 1;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrators only' using errcode = 'P0001';
  end if;

  if v_first = '' or v_last = '' then
    raise exception 'First name and last name are required' using errcode = 'check_violation';
  end if;

  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'A user must have at least one role' using errcode = 'check_violation';
  end if;

  if 'superadmin' = any (p_roles) then
    raise exception 'Super administrator role cannot be assigned' using errcode = 'P0001';
  end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.user_roles
     where user_id = p_user_id and role in ('admin', 'superadmin')
  ) into v_target_is_admin;
  v_wants_admin := 'admin' = any (p_roles);

  if (v_target_is_admin or v_wants_admin) and not v_is_super then
    raise exception 'Only super administrators can edit administrator accounts' using errcode = 'P0001';
  end if;

  -- A super administrator's roles are fixed; only their name can change.
  if exists (select 1 from public.user_roles where user_id = p_user_id and role = 'superadmin') then
    if not v_is_super then
      raise exception 'Only super administrators can edit administrator accounts' using errcode = 'P0001';
    end if;
  else
    delete from public.user_roles
     where user_id = p_user_id and role <> all (p_roles);

    insert into public.user_roles (user_id, role)
    select p_user_id, r from unnest(p_roles) as r
    on conflict (user_id, role) do nothing;
  end if;

  update public.profiles
     set first_name = v_first,
         last_name  = v_last,
         full_name  = v_full
   where id = p_user_id;

  if 'parent' = any (p_roles) then
    insert into public.guardians (profile_id) values (p_user_id)
    on conflict (profile_id) do nothing;
  end if;

  -- Tutor role: keep the staff row in step (suspend rather than delete; history hangs off it).
  if 'tutor' = any (p_roles) then
    if exists (select 1 from public.tutors where profile_id = p_user_id) then
      update public.tutors set status = 'active'
       where profile_id = p_user_id and status = 'inactive';
    else
      v_base_slug := trim(both '-' from regexp_replace(lower(v_full), '[^a-z0-9]+', '-', 'g'));
      if v_base_slug = '' then
        v_base_slug := trim(both '-' from regexp_replace(lower(split_part(v_email, '@', 1)), '[^a-z0-9]+', '-', 'g'));
      end if;
      if v_base_slug = '' then v_base_slug := 'tutor'; end if;

      v_slug := v_base_slug;
      while exists (select 1 from public.tutors where slug = v_slug) loop
        v_suffix := v_suffix + 1;
        v_slug := v_base_slug || '-' || v_suffix::text;
      end loop;

      insert into public.tutors (profile_id, slug, employment_type, headline, status)
      values (p_user_id, v_slug, 'sessional', '', 'active');
    end if;
  else
    update public.tutors set status = 'inactive'
     where profile_id = p_user_id and status = 'active';
  end if;

  return p_user_id;
end;
$fn$;

revoke execute on function public.update_user_for_admin(uuid, text, text, public.app_role[]) from public, anon;
grant execute on function public.update_user_for_admin(uuid, text, text, public.app_role[]) to authenticated;
