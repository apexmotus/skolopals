-- list_users_for_admin / get_user_for_admin failed at runtime with
-- SQLSTATE 42804 "structure of query does not match function result type":
-- auth.users.email is varchar(255), so coalesce(u.email, '') is varchar, but both
-- functions declare `email text` and plpgsql's RETURN QUERY requires an exact type
-- match. Redefine them with an explicit ::text cast. Signatures, grants and
-- behaviour are otherwise unchanged from 20261113000002 section 6.

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
         p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = p_user_id;
end;
$fn$;
