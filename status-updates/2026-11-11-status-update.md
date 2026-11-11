# Status Update — Skolopals — 2026-11-11

## Since last update (2026-11-10)
- **Web cutover advanced two slices.** The auth slice is finished and the `people`/`tutors` slice
  shipped (`5d7cec2`, `1be38cf`): `web/src/lib/auth.ts`, `lib/tutor.ts` and `lib/queries.ts` now
  have zero direct `.from()`/`.rpc()` calls. Remaining in `lib/`: `admin.ts` 17, `parent.ts` 9,
  `assessment.ts` 7, `messages.ts` 5 (38 total), plus 55 call sites in `app/**/actions.ts` and
  pages (largest: `admin/timetable/actions.ts` 9, `admin/tutors/actions.ts` 7, `admin/billing/page.tsx` 4).
  `docs/web-cutover-plan/04-acceptance-checklist.md` has not been ticked for `people` + `tutors`.
- **Rate limiting rewritten** (`9d0af91`): `@nestjs/throttler` dropped because its CJS build
  `require()`s ESM-only `@nestjs/common` and crashed every request on Vercel with
  `ERR_REQUIRE_ESM`. Replaced by `@fastify/rate-limit` as the global default (`api/src/main.ts:38`)
  plus a custom Redis `ThrottleGuard` for `@Throttle(5, 60_000)` on `POST /enquiries`.
- **9th RLS fix via cutover work**: `db/migrations/20261110000001_profiles_public_read_active_tutors.sql`.
- **The Deploy pipeline has failed 12 out of 12 runs since it merged**, for three different
  reasons in sequence: `api/api` root-directory doubling on 2026-11-10 (ENOENT), Playwright apt
  install failures midday 2026-11-11 (fixed by `db3b36a`'s retry), and now the web smoke test
  failing because every data endpoint on the dev API returns 500. See Summary.
- **Uncommitted in the working tree**: `api/src/app.module.ts` adds pino redaction for
  `x-vercel-oidc-token`, `x-vercel-proxy-signature` and `forwarded` (a debugging aid for the above,
  worth keeping), plus `api/tsconfig.build.tsbuildinfo` churn.
- **Not moved**: no DB-migration step in CI (yesterday's Risk #1 — it has now bitten),
  `db/deploy/01_reset_remote.sql` still has no confirmation gate, `.env.example:37` still
  `SWAGGER_ENABLED=true`, uneven per-module coverage. POPIA not re-raised per yesterday's direction.

## Summary
Skolopals is a Next.js 16 site plus NestJS API for a tutoring centre in Damonsville, Brits,
sharing one Supabase Postgres. **The code is healthy but nothing is live.** API: 383 tests pass
(up from 374), typecheck clean. Web: typecheck and lint clean. The gated pipeline works as
designed and is correctly refusing to promote. What it is refusing to promote is this: the dev
API boots and reports healthy (`/api/health/ready` shows Postgres 400 ms and Redis 2 ms, both up),
but **every table-backed endpoint returns 500** (`/reference/grades`, `/reference/subjects`,
`/packages`, `/tutors`, `/timetable/public` all probed live). The live Supabase project's
PostgREST returns `PGRST205 Could not find the table` for `grades`, `school_phases`, `packages`,
`profiles` and `data_retention_policies`, and also for the old marketplace tables `tutors` and
`bookings`. **The schema has never been pushed to the live database** (README still lists Phase 8
"push schema to the live Supabase project" as Next). Meanwhile the production and UAT API aliases
return Vercel `DEPLOYMENT_NOT_FOUND`, the API project's original URL `skolopals-omega.vercel.app`
500s even on `/api/health/live` (the crash-loop build is still what its production slot holds),
and `skolopals-web.vercel.app` serves a pre-pipeline deployment that throws `API_URL is not set`
on `/` (15 occurrences since 2026-11-08 in Vercel runtime errors). The single most important thing:
apply `db/` migrations and seeds to the live project, then re-run Deploy.

## Architecture
- **Rate limiting is now two-layered and the layers behave differently on Vercel.**
  `@fastify/rate-limit` uses an in-memory store per function instance, so under Fluid Compute the
  effective global limit is N times `THROTTLE_LIMIT` across N warm instances. Acceptable as a
  defensive default, but it is not the hard cap the env var name implies. The Redis-backed
  `ThrottleGuard` (`api/src/common/guards/throttle.guard.ts:26-40`) is the real per-route cap.
- **`ThrottleGuard` has a hard Redis dependency and no unit test.** `guards/` carries specs for
  `jwt-auth` and `roles` only. `redis.incr` at line 35 has no fallback: if Redis is unreachable,
  the public enquiry form's POST hangs through ioredis's offline queue and then 500s, rather than
  degrading. The guard runs third in `APP_GUARD` order after JWT and Roles
  (`common.module.ts:36-38`), which is correct for public routes.
- **The cutover has coupled public-page availability to the API with no graceful path.**
  `web/src/lib/api/client.ts:62` throws `ApiError` on any non-2xx and no public page catches it,
  so an API outage turns `/`, `/pricing`, `/timetable` and `/privacy` into HTTP 500s (observed
  live today). Before the cutover the same pages used `data ?? []` and rendered empty sections.
  This is the "which error convention wins" question from yesterday, now with a concrete cost.
- **Pipeline shape** (`.github/workflows/deploy.yml`): UAT is an alias flip of the byte-identical
  dev build (good), production is a separate rebuild with production env. The production artifact
  is therefore never smoke-tested, and nothing runs after `deploy-prod`. `docs/DEPLOY.md` is
  accurate and honest about this. There is still no job that touches `db/`.
- **Well done, protect this**: the smoke test (`web/scripts/smoke.mjs`) is a real headless-browser
  check with console-error capture, and it caught a real outage before UAT. `SqlErrorMapper`
  verified live: the dev API's 500 body is `An unexpected error occurred.` with a `traceId`, no
  Postgres text. `JwtAuthGuard` default-deny verified live (`GET /enquiries` → 401).
  `docs/DEPLOY.md` is the clearest ops doc in the repo.

## Where things stand
- **`api/`: done and green.** 383 tests, typecheck clean, builds. One uncommitted, worthwhile
  logging tweak.
- **`db/`: 32 migrations locally, zero visible on the live project.** `db/deploy/02_apply_rest.md`
  claims migrations 001–003 are "already applied and recorded", but PostgREST cannot see
  `profiles` (created by 003) or `grades` (002). Either the schema was reset after that note was
  written, `public` is not in the exposed schemas, or the note is wrong. `make verify` or the SQL
  editor settles it; the Supabase MCP connection in this session was denied SQL permission.
- **`web/` cutover: 3 of the plan's 7 module slices done** (`reference`+`packages`+`timetable`,
  auth, `people`+`tutors`). 93 direct Supabase call sites remain across `lib/` and `app/`.
  The checklist's entire "Deployment" section is unticked and is literally the current blocker.
- **Pipeline: `deploy-dev` and the API smoke pass; web smoke fails; `uat`/`production` jobs have
  never executed.** The approval gates have never been exercised.
- **Docs**: root `README.md` phase table is accurate (Phase 8 "Next"). `04-acceptance-checklist.md`
  lags by one slice.

## Risks: things that could fail unexpectedly
Will bite now or next deploy:
1. **Live DB has no schema** → every data endpoint 500s, every web page that calls the API 500s.
   Fix is the existing runbook in `db/deploy/README.md` (`make migrate seed DATABASE_URL=...` or
   `supabase db push`, then `make verify`). Check `public.schema_migrations` state first, since
   `migrate.sh` decides what to apply from it.
2. **Pipeline still has no migration step.** Once the schema is applied by hand, the next commit
   that adds a migration repeats today's outage exactly. The runbook's "later deploys" path is a
   one-liner (`supabase db push`) that could be a job before `deploy-dev`.
3. **Visitors to `skolopals-web.vercel.app` get a 500 today** (stale pre-pipeline deployment,
   `API_URL` unset). `skolopals-omega.vercel.app` 500s on the liveness probe. Nothing in the
   pipeline will replace either until the web smoke passes and two approvals are given.
4. **Public pages hard-fail on any API error** (`client.ts:62`, no catch in `(public)/page.tsx`).
   Blast radius of an API incident now includes the marketing site.
5. **`ThrottleGuard` + Redis**: enquiry form unavailable if Redis is down; guard is untested.

Theoretical but worth knowing:
6. `@fastify/rate-limit` per-instance counters on serverless (see Architecture).
7. `db/deploy/01_reset_remote.sql` still runs `begin;...drop...;commit;` with no gate. More
   relevant this week than ever, because the first-deploy runbook tells the operator to run it.
8. `api/tsconfig.build.tsbuildinfo` is tracked in git and changed in 5 of the last 6 commits.
   Add it to `.gitignore`.
9. `.env.example:37` `SWAGGER_ENABLED=true` vs schema default `false` (unchanged).
10. Uneven per-module API coverage (unchanged from yesterday, not re-measured).

## Security notes
Lightweight pass. No regressions. Verified live on the dev API: error bodies leak no database
detail, unauthenticated access to a protected route is denied, helmet and CORS allow-list are
unchanged. The uncommitted log redaction of Vercel's OIDC and proxy-signature headers is a
genuine improvement and should be committed. The Supabase publishable key in GitHub repo
variables is public by design. One shared Supabase project across dev/uat/prod (flagged in
`DEPLOY.md`) becomes a real concern the moment the schema is pushed, because that database is
then "production" for all three stages at once.

## Open questions for you
1. Was `01_reset_remote.sql` already run against the live project? PostgREST shows neither old nor
   new tables, which fits "reset done, migrations never applied", but `02_apply_rest.md` says
   001–003 were applied. The answer decides whether `make migrate` or the full first-deploy path
   is right.
2. Is one shared Supabase project for dev/uat/prod still acceptable now that the first real
   schema push is imminent?
3. Should public pages degrade gracefully (render the section empty) when the API fails, or is
   fail-loud intended?
4. Is tracking `tsconfig.build.tsbuildinfo` in git intentional?

## Direction (decided 2026-11-11)
- **Schema push to the live Supabase project: owner runs it.** The operator will run the
  `db/deploy` runbook themselves (check `public.schema_migrations` state first, then
  `make migrate seed` or `supabase db push`, then `make verify`). Follow-up once done: curl
  `https://skolopals-api-dev.vercel.app/api/v1/reference/grades` for a 200, then re-run Deploy.
- **Add a migration job to the pipeline before `deploy-dev`**, gated on the same approvals, so a
  code change that depends on a new migration can never again ship ahead of the schema. Needs
  `DATABASE_URL` as a GitHub secret (today it lives only on the Vercel api project).
- **Public pages degrade gracefully.** Catch `ApiError` in the public reads (`lib/queries.ts`
  callers for `/`, `/pricing`, `/timetable`, `/privacy`, `/tutors`) and render the section empty,
  matching pre-cutover behaviour. Portals (parent/tutor/admin) stay fail-loud.
- **Stale production web deployment stays as-is** until the pipeline passes end to end; the first
  green Deploy replaces it. No holding page.
