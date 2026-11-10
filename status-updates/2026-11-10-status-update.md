# Status Update — Skolopals — 2026-11-10

## Since last update (2026-11-05)
A huge amount shipped in the last five days — more than any prior gap between reviews:

- **The entire NestJS API plan (Phases 0–4) is now complete.** All 19 modules exist (reference,
  people, tutors, packages, enrolment, timetable, attendance, programmes, assessment,
  progress-reports, billing, finance, consent, enquiries, communication, resources, reviews,
  auth, health). 374 unit tests pass (up from the 371 last recorded), 75.16% line coverage,
  `pnpm typecheck`/`lint`/`build` all clean, `pnpm audit --prod` clean. Seven real RLS gaps were
  found and fixed along the way (all previously recorded in memory).
- **`api/` now boots as a production build.** Commit `664cac0` converted it to ESM after the
  prior build silently didn't boot; re-verified this round by actually running
  `node dist/main.js` against a real local Postgres — clean init through every module, no leftover
  CJS artifacts (`require(`/`__dirname`) anywhere in `src/`.
- **A gated CI/CD pipeline landed** (`.github/workflows/ci.yml` + `deploy.yml`, commit `ad4024e`):
  lint/typecheck/test/build for both `api/` and `web/` on every PR, then
  deploy-dev → smoke-dev → deploy-uat → deploy-prod, with real GitHub Environment
  `required_reviewers` protection configured on `uat` and `production` — the "gated" claim in the
  commit message is genuine, not just a name.
- **Phase 5 (the `web/` cutover to calling `api/` instead of Supabase directly) has actually
  started** — contradicting the 2026-11-08 cutover-plan memory's own "zero implementation
  started" framing, which is now stale. `web/src/lib/api/client.ts` exists and is wired into the
  auth slice and the `reference`/`packages`/public-timetable reads. Real progress, but partial:
  see "Where things stand" below.
- **An 8th RLS gap found and fixed, via the cutover work itself, not a planned audit**:
  `data_retention_policies` had no public read policy, so the public `/privacy` page's "how long
  we keep it" table silently rendered empty for every non-admin visitor — the one table the
  privacy notice exists to disclose. Fixed additively in
  `db/migrations/20261108000001_retention_policies_public_read.sql`.
- **Risk #1 from the last two reviews is resolved**: everything above is committed. `git status`
  is clean; nothing is sitting unprotected in the working tree or staging area this time.
- **Not moved**: POPIA policy sign-off (3rd consecutive review with zero movement), `web/README.md`
  (3rd consecutive review still describing the old hourly-marketplace app), and
  `db/deploy/01_reset_remote.sql`'s missing confirmation gate.

## Summary
Skolopals is a Next.js 16 app for a physical tutoring centre in Damonsville, Brits, now fronted
by a purpose-built NestJS API (`api/`) that sits between `web/` and the same live Supabase
Postgres database (Supabase Auth unchanged). The API build is genuinely done and well-tested; a
gated CI/CD pipeline exists to ship it. The two things actually in flight right now are: (1)
migrating `web/`'s ~62 Supabase call sites over to the new API, about 20–25% complete, and (2)
getting the finished CI/CD pipeline (currently an open, unreviewed PR) onto `main`. Overall health
is good — most open items are documentation lagging reality or process gates not yet exercised,
not functional defects.

## Architecture
**`api/`** — consistently well-built. Every module follows the same conventions
(`StoredProcRunner`'s three call shapes, RLS-context wrapping, `UnitOfWork`, `CacheService`), no
module deviates. Security middleware is solid: `main.ts:35-39` registers helmet + compression,
CORS is an explicit origin allow-list (`CORS_ORIGINS` env, not `*`) with `credentials: true`, and
a global `ValidationPipe` runs `whitelist + forbidNonWhitelisted + transform`. `SqlErrorMapper`
deliberately never leaks raw Postgres error text to clients (verified by its own test). Pool
sizing is env-driven (`DB_POOL_MAX`), matching the Vercel Fluid Compute deployment target decided
earlier. Coverage is uneven across modules even though the overall gate clears —
`modules/timetable` 61%, `modules/people` 58%, `modules/packages` repository 43% — a known,
previously-noted gap, not a new regression.

**`web/`** — the Server Components/Server Actions/`proxy.ts` session-gate pattern stays
consistent. The partial cutover has introduced one real, if currently harmless, inconsistency:
`auth.ts` and `queries.ts` now each mix two different failure conventions in the same file — the
new `api/client.ts`'s uniform `ApiError` throw for non-2xx responses, and the older `data ?? []`
silent-empty-on-error pattern for the Supabase calls still sitting a few lines below it. Nobody's
hit this yet, but it's worth deciding which convention wins codebase-wide before migrating more
modules, rather than letting it spread file by file.

**CI/CD** — gates on the right things (tests, types, lint, build, manual approval before
uat/prod) but has a real structural gap: **no step deploys or verifies `db/` migrations**.
`deploy.yml` ships `api/` and `web/` as two separate Vercel projects but schema changes remain a
manual, out-of-band `make migrate` against the live project — a deploy could ship API code that
assumes a migration nobody ran yet.

## Where things stand
- **`api/`: done.** All 19 modules built, tested, hardened; this is a completed, shippable
  artifact as of this review.
- **CI/CD pipeline: built, not yet live.** PR #1 (`ci/prod-ready-pipeline` → `main`) is open,
  mergeable, both CI checks green, **zero reviews** since it opened 2026-11-08. Everything above
  — the gated pipeline, the ESM fix, the typecheck fix — is sitting on a branch, not on `main`.
- **`web/` Phase 5 cutover: ~20-25% done by file, in progress, not stalled.** Concretely, against
  the plan's own sequencing:
  - *Done*: `reference`/`packages`/public-timetable reads (`queries.ts` lines 23-44, 67-72, 201,
    207, 228 all now call `api.get`).
  - *Partial*: the auth slice — `auth.ts:32` calls `api.get("/people/me")`, but `auth.ts:74,86`
    still hit Supabase directly for tutor-profile and guardian-link lookups. This looks like
    leftover unmigrated work, not a deliberate choice (unlike Supabase Auth itself, correctly left
    untouched everywhere, e.g. `proxy.ts:27`).
  - *Not started*: `people`/`tutors` (`tutor.ts`, 6 sites), `admin.ts` (17 sites — dashboard,
    finance, enrolment queue, enquiries), `parent.ts` (9 sites), `messages.ts` (5 sites),
    `assessment.ts` (7 sites) — none of these import `api/client` yet.
  - `docs/web-cutover-plan/04-acceptance-checklist.md` (new this round) self-reports this honestly
    — only the first slice is checked off, nothing overstated there.
- **Root `README.md` now overstates cutover progress**: it claims "the `api/` NestJS service...
  is what `web/` now calls for everything except Supabase Auth itself; `web/` won't come up
  correctly without it running" — not true yet; 7 files still make direct Supabase calls and
  `web/` runs fine against Supabase alone today. A newly-introduced documentation-accuracy gap,
  distinct from the long-standing `web/README.md` problem below.
- **`web/README.md`: still unfixed, 3rd consecutive review.** Still describes the old
  hourly-booking marketplace app in full, including a `supabase/migrations` directory that no
  longer exists.
- **POPIA policy: still blocked, 3rd consecutive review with zero movement.** All placeholder
  fields (Information Officer email/phone, business registration number, Information Regulator
  registration date, business email) remain `[TO CONFIRM]`. No owner or timeline assigned.

## Risks: things that could fail unexpectedly
Ranked most-severe first.

1. **CI/CD pipeline has no database-migration step.** `deploy.yml` deploys `api/` and `web/` code
   but never runs `db/`'s migrations against any environment — a promoted deploy can silently
   assume schema that was never pushed. No rollback job exists either (rollback today means
   manually re-aliasing a prior Vercel deployment).
2. **The finished pipeline + ESM fix + typecheck fix are all unreviewed and unmerged.** PR #1 has
   sat open since 2026-11-08 with zero reviews despite passing CI. Every safety mechanism it adds
   (gated environments, manual approval) provides zero protection until it's on `main`.
3. **Root `README.md` gives a materially wrong mental model of the system's current state** —
   anyone onboarding from it would believe the cutover is done when it's ~20-25% complete. Low
   effort to fix, high value for anyone picking this up next.
4. **`db/deploy/01_reset_remote.sql` still has no confirmation gate** before its irreversible
   `begin;...drop...;commit;` block — unchanged across three consecutive reviews, now more
   relevant than ever given the pipeline work actively pointing at real environments.
5. **POPIA sign-off has had zero movement across three reviews** — this blocks a safe public
   go-live independent of all the technical readiness work above, and still has no named owner.
6. **Mixed error-handling conventions inside `auth.ts`/`queries.ts`** during the partial cutover —
   theoretical today (nothing's broken), but will get harder to unwind the longer both patterns
   coexist across more files.
7. **`web/README.md` stale for a 3rd review in a row** — same onboarding-risk class as #3, lower
   severity only because it's long-standing and already flagged.
8. **`.env.example:37` sets `SWAGGER_ENABLED=true`**, while the schema's real default
   (`env.schema.ts:55`) is `false`. Low severity — no evidence any real environment sources its
   config from the example file — but an example that gets copy-pasted should default safe.
9. **Uneven per-module test coverage in `api/`** (`timetable` 61%, `people` 58%, `packages`
   repository 43%) — the overall 75% gate passes, already noted as an accepted gap in Phase 4,
   not a new issue.

## Security notes
Lightweight pass only. `api/` is clean: explicit CORS allow-list, helmet, strict validation
pipe, no leaked error detail, `pnpm audit --prod` reports no known vulnerabilities, no secrets
committed. `web/`'s new `api/client.ts` forwards the Supabase session's access token correctly
(server-only, never exposed to the browser, `cache: "no-store"` avoids cross-user cache bleed).
The only concrete finding is the `SWAGGER_ENABLED` example-default mismatch above (#8) — low
severity, easy fix.

## Open questions for you
1. **PR #1 has been open 2 days with passing CI and zero reviews** — is it waiting on you
   specifically, or just hasn't surfaced? Merging it is what actually turns the new safety gates
   on.
2. **The web cutover is genuinely in progress** (not "nothing to migrate" as earlier framing
   suggested) — do you want to keep going module by module per the plan's sequencing
   (`people`/`tutors` next), or pause here for something else?
3. **Root `README.md`'s overstated claim** — fix it now to match reality, or let it catch up once
   the cutover is actually further along?
4. **POPIA sign-off has had zero owner for three reviews running** — worth escalating/assigning
   explicitly now, or still consciously deferred?
5. Opportunistic: since Phase 5 touches exactly the architecture `web/README.md` should describe,
   is now a sensible moment to finally rewrite it, or keep treating it as separate cleanup?

## Direction (decided 2026-11-10)
- **PR #1 merged** during this review (`7eb71de` onto `main`) — the gated CI/CD pipeline, ESM fix,
  and typecheck fix are now live and protecting real deploys, not just sitting on a branch.
- **Web cutover continues per the plan's existing sequencing** — next up: finish the auth slice
  (`auth.ts:74,86` still call Supabase directly), then `people`/`tutors`, matching
  `docs/web-cutover-plan/03-sequencing-and-rollout.md`.
- **POPIA sign-off**: owner is sharing the policy content/status directly rather than this being
  escalated as a process item — not re-raise as an open risk until that materializes.
- **Both documentation gaps fixed this session**: root `README.md` no longer claims `web/` fully
  depends on `api/` (corrected to describe the in-progress cutover accurately, pointing at
  `docs/web-cutover-plan/04-acceptance-checklist.md` for the current module list); `web/README.md`
  fully rewritten to describe the actual current app (parent/learner/tutor/admin portals,
  CAPS/ZAR/package model, the `api/client.ts` partial-migration pattern), replacing the stale
  hourly-marketplace description that had been flagged for three consecutive reviews.
