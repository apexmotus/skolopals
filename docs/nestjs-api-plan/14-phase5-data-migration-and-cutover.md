# Phase 5 — Cutover

**Rewritten 2026-11-05 — much smaller than the file this replaces.** The original version of
this phase existed because the plan moved the database to SQL Server, which meant either a real
data migration or (as decided 2026-11-05, since no real production data existed) standing up a
fresh SQL Server instance with seed data. **None of that applies now.** The database never
moves — it's the same Supabase Postgres project throughout, before, during, and after this
phase. There is nothing to export, transform, load, or reconcile. Supabase Auth and Supabase
Storage are likewise untouched.

**What Phase 5 actually is now**: switching `web/`'s *data-access path* from calling Supabase
directly to calling the new NestJS API, for everything except auth (which stays direct to
Supabase per `06-phase2-auth.md`) and Storage uploads (which stay proxied through the API's
`FileStorageService` per `04-phase0...md` §3, unchanged from earlier phases).

## Steps

1. Confirm every Phase 3 slice (3a–3f) is done and verified per its own file — this phase has no
   independent engineering work of its own beyond the switch-over itself, so it can't meaningfully
   start before Phase 3f is.
2. `web/src/lib/supabase/{client,server}.ts` and every `.rpc()`/`.from()` call site enumerated
   during this plan's research (14 RPC call sites, ~60 table/view read call sites across
   `web/src/app/**`) get replaced with calls to the new REST API, **except** the Supabase Auth
   client itself, which `web/` keeps using exactly as today for register/login/logout/refresh/
   session. This is itself a sizeable piece of `web/`-side work — **not estimated or sequenced
   in this document**, since it's not part of the NestJS API build this plan covers; it deserves
   its own plan once the API is far enough along (realistically, started once Phase 3b is done,
   since that's when enough of the app's actual page-level data needs are servable).
3. `web/` keeps sending Supabase's access token as the `Authorization: Bearer` header on every
   call to the new API — the same token it already holds from Supabase Auth, just handed to a
   different backend now. No new session/cookie mechanism needs designing; `web/`'s existing
   Supabase session handling is unchanged.
4. Keep the old direct-Supabase `web/` code paths behind a flag or on a separate deploy until
   the API-backed version is verified end-to-end — this is the rollback path for this phase.
   Reverting a `web/` deploy is cheap; there is no equivalent "decommissioned infrastructure to
   re-stand-up" risk this time, since nothing about the database, auth, or storage changed.

## Verify

- `web/` against the new API passes a manual smoke pass across every portal (public site,
  parent, tutor, admin) — walk each portal's primary flows once in a browser against the
  switched-over app before calling cutover complete. This plan's own scope ends at the API; an
  API with no verified real consumer isn't actually done.
- RLS behaves identically through the new API as it did through direct Supabase/PostgREST calls
  for every role — spot-check at least one "wrong actor gets nothing" case per module during
  this pass, not just the happy path, since `04-phase0...md` §1's `set_config` pattern is the one
  mechanic in this whole plan that was genuinely new and unproven before Phase 1's spike.
- Confirm no remaining `web/` code path still calls Supabase directly for data it should now be
  getting from the API (grep for `.rpc(`/`.from(` outside the Auth/Storage call sites that are
  supposed to remain) — a half-migrated `web/` with some pages on the old path and some on the
  new one is the main way this phase could silently fail to actually finish.
