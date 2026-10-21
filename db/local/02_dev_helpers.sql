-- Local only. Lets you exercise RLS from psql by impersonating a user, the way
-- PostgREST would. Never deployed: the `dev` schema does not exist on Supabase.

create schema if not exists dev;

-- Impersonate a signed-in user. Pass the auth.users id.
create or replace function dev.login_as(p_user_id uuid, p_role text default 'authenticated')
returns void
language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id::text, 'role', p_role)::text,
                     false);
  execute format('set role %I', p_role);
end;
$fn$;

-- Become an anonymous visitor.
create or replace function dev.login_anon()
returns void
language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  set role anon;
end;
$fn$;

-- Drop back to the owning superuser (bypasses RLS).
create or replace function dev.logout()
returns void
language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims', '', false);
  reset role;
end;
$fn$;

comment on schema dev is 'LOCAL ONLY - test helpers for exercising RLS. Never deployed.';

-- The helpers must stay reachable AFTER `set role anon`, otherwise logging in
-- is a one-way trip and you cannot test a second role in the same session.
-- RESET ROLE always returns to session_user, so this grants nothing dangerous
-- and this schema is local-only in any case.
grant usage on schema dev to public;
grant execute on all functions in schema dev to public;

-- Assertion helper for scripts/test-rls.sh.
create or replace function dev.assert(p_ok boolean, p_what text)
returns void language plpgsql as $fn$
begin
  if p_ok then
    raise notice '  PASS  %', p_what;
  else
    raise exception 'FAILED: %', p_what using errcode = 'P0001';
  end if;
end;
$fn$;

grant usage on schema dev to public;
grant execute on all functions in schema dev to public;
