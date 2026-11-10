-- `profiles` only ever had "profiles: read self or admin" (granted to `authenticated`
-- only, not `anon`). The public tutor directory (/tutors, /tutors/[slug]) has always
-- joined `tutors` to `profiles` for the tutor's own name — for a genuinely anonymous
-- visitor (no session at all, the normal case for a marketing site), that inner join
-- silently returned zero rows, because `profiles` RLS denied `anon` entirely. Live-verified
-- directly against this schema (as `anon`, no JWT): the exact join the public pages run
-- returns 0 rows for an active tutor whose profile row plainly should be visible, since a
-- tutor's name is exactly as public as their headline/bio already are. Found while porting
-- these pages to the new API (web-cutover-plan) — a pre-existing bug, not introduced by
-- that port, and not previously caught because every earlier live-testing pass in this
-- project only varied *role*, never *the complete absence of a session*.
--
-- Additive only: the existing self-or-admin policy is untouched. Scope matches `tutors`'s
-- own "public read active" policy exactly, so a profile is never exposed beyond what the
-- directory already shows via the tutor's own row.
create policy "profiles: public read for active tutors" on public.profiles
  for select to anon, authenticated
  using (exists (
    select 1 from public.tutors t
    where t.profile_id = profiles.id and t.status = 'active'
  ));
