-- `data_retention_policies` had only "retention_policies: admin only" (a
-- `for all` policy), so an anonymous or signed-in-but-non-admin visitor to
-- the public privacy notice (/privacy) got zero rows back from "How long we
-- keep it" -- the exact table the notice exists to disclose. Found while
-- porting web/'s direct Supabase read to the API (web-cutover-plan), same
-- class of gap as consent_types, which already has this pair of policies.
-- Additive only: the existing admin-only policy is untouched, so writes
-- still require admin.
create policy "retention_policies: public read" on public.data_retention_policies
  for select to anon, authenticated using (true);
grant select on public.data_retention_policies to anon, authenticated;
