# Phase 5 Acceptance Checklist

## Scope confirmation (confirmed 2026-11-08 by grep, see `00-overview.md`)

- [x] No client-side (`"use client"`) Supabase data access exists to migrate.
- [x] No Realtime channel usage exists to migrate.
- [x] No Supabase Storage usage exists in `web/` to migrate.
- [x] Auth flows (`(auth)/actions.ts`, `auth/confirm/route.ts`, `proxy.ts`) stay on Supabase Auth
      directly, confirmed unchanged by this plan — except the `user_roles` read inside
      `getSession()`/`login()`, called out explicitly as its own first slice.

## The API client

- [x] `web/src/lib/api/client.ts` exists, is `server-only`, forwards the real Supabase session's
      `access_token` as `Authorization: Bearer`, and maps the API's `{status, code, detail, ...}`
      error shape into each call site's existing error convention.
- [x] 401 → redirect to `/login` (see `02-api-client-and-auth.md`'s note: no reliable server-side
      "current path" accessor outside middleware, so no `?next=`; `proxy.ts` is the primary path
      for that and already runs first); 403 is left to propagate as `ApiError` for each call site
      to handle (no call site needed this yet — none of today's modules return 403).
- [x] Verified against a real, locally-running `api/` instance (not a mock) before any module
      migration started. **Correction found this way**: every response is wrapped in a
      `{ data, meta? }` envelope (`ResponseEnvelopeInterceptor`) — missed by this plan's own
      illustrative snippet, caught immediately by booting `api/` and curling it. `client.ts`
      unwraps it (`api.get`/`.getPaged`).

## The auth/session slice

- [x] `lib/auth.ts`'s `getSession()` and `(auth)/actions.ts`'s `login()` both call the API for
      roles instead of reading `user_roles` directly.
- [x] Confirmed (not assumed): `GET /people/me` was profile-only (no roles). Fixed with a small
      additive change — `MyProfileDto` now echoes `actor.roles` (already resolved per-request by
      `JwtAuthGuard`, zero extra DB cost) — rather than a second call.
- [ ] Live-verified: logging in as each of admin/tutor/parent/learner lands on the correct
      `homeFor` destination, and `requireRole` still correctly redirects a wrong-role actor away
      from a protected page. **Blocked, by agreement**: needs either a local Supabase Auth
      (GoTrue) stack or a confirmed cloud test account — neither available now (the cloud
      project's Postgres doesn't have the new schema deployed yet, per Phase 8). What *is*
      live-verified: `GET /people/me` against the real running `api/` with a locally-minted,
      correctly-signed JWT (`SUPABASE_JWT_SECRET`) and a real Postgres row — confirmed roles
      (including multiple roles on one actor) come back correctly.

## Module-by-module migration (per `03-sequencing-and-rollout.md`'s order)

- [x] `reference` + `packages` + public `timetable` — see note below.
- [ ] `people` + `tutors`
- [ ] `enquiries` + `enrolment` + `packages` writes
- [ ] `timetable` + `attendance` + `programmes`
- [ ] `assessment` + `progress-reports`
- [ ] `billing` + `finance`
- [ ] `consent` + `communication` + `resources` + `reviews`

Each box above means: zero remaining `.from()`/`.rpc()` calls for that module's tables/functions
anywhere in `web/src/` (re-grep to confirm, don't assume the PR got every call site), the
module's pages/actions live-tested against a real running `api/` as every role that can reach
them, and `pnpm typecheck`/`pnpm lint` clean.

**`reference` + `packages` + public `timetable` — done 2026-11-08, notes for the next slice:**
- `lib/queries.ts`'s `searchTutors`/`getTutorBySlug`/`getPublishedReviews`/`DirectoryTutor` are
  **deliberately untouched** — they belong to the next module (`people` + `tutors`), not this one,
  despite living in the same file.
- `GET /packages` has no batched "packages with current price" endpoint, so `getPackages()` now
  does `GET /packages` + one `GET /packages/:code/price` per package in parallel (small N,
  cache-backed API-side) — a real N+1, not a logic change; a 404 (no price set, e.g. `holiday`)
  maps to `amountCents: null`, same as before.
- `GET /programmes` applies no `is_published`/`ends_on` filter itself (admin gets everything, RLS
  only gates `is_published` for everyone else) — both filters are now applied client-side in
  `getPublishedProgrammes()`, same as the old direct query did.
- **Found and fixed a real pre-existing bug while migrating `/privacy`**: `data_retention_policies`
  had no API endpoint and an admin-only RLS policy, so its "How long we keep it" table had
  silently rendered empty for every non-admin (anonymous included) visitor to the public privacy
  notice. Fixed with `db/migrations/20261108000001_retention_policies_public_read.sql` (additive
  public-read policy, mirrors `consent_types`) + a new `GET /reference/data-retention-policies`
  endpoint. Live-verified.
- Every endpoint this slice touches was live-verified against the real running `api/` and real
  local Postgres, including rendering the actual pages (`/pricing`, `/subjects`, `/timetable`,
  `/contact`, `/programmes`, `/privacy`) through a real `web/` dev server.

## Cleanup

- [ ] Zero `.from()`/`.rpc()` calls remain anywhere in `web/src/` outside the auth-flow files
      named above (re-grep the whole tree to confirm — the same command used to build
      `01-call-site-inventory.md`).
- [ ] Decision made (and recorded) on whether to trim `database.types.ts` or leave it as-is.
- [ ] `web/README.md` rewritten — it still describes the old hourly-marketplace app entirely
      (flagged back in the 2026-11-02 status-update and still true as of this plan; not caused
      by this phase, but this phase is a natural point to fix it since the data-access
      architecture it should describe is finally changing).

## Deployment

- [ ] `api/` and `web/` each provisioned as their own Vercel project.
- [ ] `web/`'s `API_URL` env var (per project/environment — production, preview) points at the
      correct `api/` deployment.
- [ ] `api/`'s `CORS_ORIGINS` includes `web/`'s actual production domain (defensive; this
      traffic is server-to-server, but keep it correct regardless).
- [ ] A full manual smoke pass through all four portals (public, parent, tutor, admin) against
      the deployed (not just local) API, once both projects are live.
