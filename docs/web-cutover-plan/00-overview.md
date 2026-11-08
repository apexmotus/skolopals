# Phase 5 Overview — the `web/` Cutover

This is the plan `../nestjs-api-plan/14-phase5-data-migration-and-cutover.md` deliberately left
unscoped ("not estimated or sequenced in this document... deserves its own plan"). The API
itself (Phases 0-4 of that plan) is done: 19 modules, ~85 endpoints, 371 unit tests, live-verified
module by module. Nothing there changes in this phase. This phase is entirely about `web/`:
replacing its direct Supabase data calls with calls to that already-built API.

## What actually changes

Confirmed by grep across all of `web/src/` (not assumed):

- **15 `.rpc()` call sites**, across 8 files, all inside `"use server"` Server Actions.
- **62 unique tables/views** read via `.from()`, across ~29 files — but concentrated: 9 files in
  `src/lib/*.ts` (`admin.ts`, `assessment.ts`, `auth.ts`, `centre.ts`, `consent.ts`, `messages.ts`,
  `parent.ts`, `queries.ts`, `tutor.ts`) account for most of them, with the rest as inline reads
  in a handful of `page.tsx`/`actions.ts` files.
- Both numbers match the API plan's own "~14 RPC / ~60 reads" estimate (see
  [[skolopals-nestjs-api-plan]]) — confirmed, not re-estimated.

See `01-call-site-inventory.md` for the full file-by-file list and which API module/endpoint each
one maps to.

## What does NOT change (confirmed, not assumed)

- **Supabase Auth stays exactly as today.** `web/` keeps calling it directly via
  `@supabase/supabase-js`/`@supabase/ssr` for login/signup/sign-out/session-refresh — this was
  already the API plan's own decision, and this phase doesn't touch any of it:
  `src/app/(auth)/actions.ts` (login/signup/signOut), `src/app/auth/confirm/route.ts`,
  `src/proxy.ts` (session-refresh + signed-in check, Vercel's `middleware.ts` equivalent). The
  **one exception**: `login()` and `lib/auth.ts`'s `getSession()` each also read `user_roles`
  directly today — that one read moves to the API, see §"The load-bearing first slice" below.
- **No client-side Supabase access exists to migrate.** Grepped for any `"use client"` file
  importing `lib/supabase/client` (the browser client) or calling `.channel(`/`.storage.`: zero
  matches, everywhere. Every single read and write in `web/` already runs server-side (Server
  Components or Server Actions via `lib/supabase/server.ts`'s cookie-based client). This matters
  a lot for scope: there is no browser bundle exposure to worry about, no CORS concern for this
  traffic (it's server-to-server, Next.js's own server calling the API's server — CORS is a
  browser-enforced mechanism and doesn't apply here), and no Realtime subscription migration to
  design.
- **No Supabase Storage migration either.** Grepped for `.storage.`/`bucket`/`signedUrl`: zero
  matches in `web/`. The tutor-document-upload feature the API's `tutors` module already supports
  (`FileStorageService`, signed URLs) isn't built in `web/` yet. Nothing to cut over here; building
  that UI (whenever it happens) should call the API from the start, not Storage directly.
- **The database itself never moves** — already true since the SQL-Server pivot; restated here
  only because `14-phase5-data-migration-and-cutover.md`'s title ("data migration") is misleading
  for what's actually left. There is no data migration. This is a call-site migration.

## The load-bearing first slice

`lib/auth.ts`'s `getSession()` (wrapped by `requireUser()`/`requireRole()`, which gate nearly
every protected page in `web/`) currently does two direct reads — `profiles` and `user_roles` —
right after resolving the JWT's `sub` claim via `supabase.auth.getClaims()`. This has to become
the API's `GET /people/me` (confirm its exact response shape against `people.controller.ts`/
`people.manager.ts` includes roles, or whether a second call is still needed — resolve this as
the first thing in `02-api-client-and-auth.md`'s implementation, not assumed here) **before any
other module's migration starts**, because every other page's access control depends on it.
`(auth)/actions.ts`'s `login()` has the same `user_roles` read, immediately after
`signInWithPassword` succeeds, and needs the identical fix in the same slice.

## Sequencing summary

Full detail in `03-sequencing-and-rollout.md`. Short version: build the API client wrapper once
(`02-api-client-and-auth.md`), migrate the auth/session slice first because everything else
depends on it, then go module-by-module through the API's own module list (lowest-risk/read-only
first), each as its own reviewable, live-tested PR — not a big-bang rewrite. This mirrors the
discipline that caught 5 real RLS gaps and 2 cross-cutting bugs while building the API itself
(see [[skolopals-nestjs-api-plan]]): a mocked test doesn't catch a wrong assumption about what an
endpoint actually returns; only running `web/` against a real running `api/` instance does.

## Files in this plan

- `00-overview.md` — this file
- `01-call-site-inventory.md` — every `.rpc()`/`.from()` call site, grouped by file, mapped to
  the API module/endpoint that replaces it
- `02-api-client-and-auth.md` — the new `web/src/lib/api/` client wrapper's design: token
  forwarding, error-shape mapping, the auth/session slice
- `03-sequencing-and-rollout.md` — module order, local-dev port collision, env vars, rollback
  posture, verification discipline
- `04-acceptance-checklist.md` — done when every box is ticked
