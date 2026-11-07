-- "resources: read if targeted"'s SELECT policy queries `resource_audiences`
-- to run the four-way audience check; "resource_audiences: read"/"resource_
-- audiences: owner write" queried straight back into `resources` to check
-- the parent row exists/is owned. Each side runs as the calling
-- `authenticated` role, so each cross-table subquery re-triggers the OTHER
-- table's own RLS policy, which queries back into the first table, forever:
-- `ERROR: infinite recursion detected in policy for relation "resources"`.
--
-- Caught live (2026-11-07, Phase 3e): the very first real `select *` or
-- `insert ... returning` against `resources` as any authenticated actor —
-- no prior module ever exercised this table through real RLS before now,
-- so this pre-existing bug had never actually been triggered.
--
-- Fixed the same way every other cross-table RLS check in this schema
-- already avoids this (`private.owns_billing_account`, `private.is_guardian_of`,
-- `private.in_thread`): a `security definer` helper, owned by the migration
-- role, queries `resources` directly -- the table owner bypasses RLS by
-- default (`relforcerowsecurity` is false everywhere in this schema), so the
-- helper's internal query never re-enters `resources`' own SELECT policy.
-- `resources`' own policy is untouched: it already queries `resource_audiences`
-- via a plain subquery, which is now safe since `resource_audiences`' policies
-- no longer trigger `resources`' RLS in response.

create or replace function private.resource_exists(p_resource_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists (select 1 from public.resources where id = p_resource_id) $fn$;

create or replace function private.resource_owned_by_actor_or_admin(p_resource_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists (
  select 1 from public.resources
  where id = p_resource_id and (created_by = (select auth.uid()) or private.is_admin())
) $fn$;

grant execute on function private.resource_exists(uuid), private.resource_owned_by_actor_or_admin(uuid)
  to anon, authenticated;

alter policy "resource_audiences: read" on public.resource_audiences
  using (private.resource_exists(resource_id));

alter policy "resource_audiences: owner write" on public.resource_audiences
  using (private.resource_owned_by_actor_or_admin(resource_id))
  with check (private.resource_owned_by_actor_or_admin(resource_id));
