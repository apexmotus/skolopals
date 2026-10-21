-- Local only. Supabase provides these roles; bare Postgres does not.
-- Idempotent: safe to re-run.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;

-- Safety check -------------------------------------------------------------
-- These roles are CLUSTER-WIDE, shared with every other database on this
-- machine. If one of them inherits from a superuser, it silently bypasses
-- every RLS policy and local RLS testing becomes worthless: broken policies
-- would pass here and fail only in production. Warn loudly; do not silently
-- change a cluster-wide grant that other databases may rely on.
do $$
declare
  bad record;
begin
  for bad in
    select member.rolname as member, granted.rolname as granted
    from pg_auth_members am
    join pg_roles member  on member.oid  = am.member
    join pg_roles granted on granted.oid = am.roleid
    where member.rolname in ('anon', 'authenticated', 'service_role')
      and granted.rolsuper
  loop
    raise warning
      E'\n'
      '  ============================================================\n'
      '  RLS TESTING IS NOT TRUSTWORTHY\n'
      '  Role "%" inherits from superuser "%", so it bypasses every\n'
      '  row-level security policy. Local RLS tests will pass even\n'
      '  when the policies are wrong.\n'
      '\n'
      '  Fix (affects every database in this cluster):\n'
      '      psql -d postgres -c ''revoke % from %;''\n'
      '  ============================================================',
      bad.member, bad.granted, bad.granted, bad.member;
  end loop;
end
$$;
