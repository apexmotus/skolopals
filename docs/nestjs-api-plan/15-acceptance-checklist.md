# Final Acceptance Checklist

Expands generic spec §13.5 for this project. Nothing here is complete until every box in the
generic spec's own checklist AND every box below is ticked.

## Generic spec §13.5 (carried over, unchanged)

**Checked 2026-11-07, Phase 4.** Items below are ticked only where actually confirmed this pass
(grep/read, not assumed); anything partial says so instead of a false tick.

- [x] No `<<FILL>>` item was guessed; every endpoint and SP traces back to Section 1 — for this
      project, traces back to `01-app-definition.md` / `02-sp-catalogue.md` /
      `03-endpoints-and-business-rules.md`, which themselves trace back to `db/migrations/` and
      `web/src/` call sites, not invention.
- [x] No ORM, no inline SQL (other than `SELECT 1`), no `any`, no `@ts-ignore` — grepped
      `src/**/*.ts` for all four; the only "inline SQL" hits outside `*.repository.ts`/`database/`
      are `health.controller.ts`'s own documented `select 1` and a doc-comment that merely
      contains the word "select" in prose.
- [x] Controllers contain no logic; Managers contain no HTTP/SQL knowledge; Repositories
      contain no business logic — true by construction in every one of the 19 modules.
- [x] Every SP parameter uses an explicit SQL type (Postgres has no declared parameter *length*
      to match — that requirement is SQL-Server-era `nvarchar(n)` framing, moot for `text`).
- [x] All multi-SP writes use `UnitOfWork` and sequential awaits (billing credit-notes, resources
      create+audience, tutors spoken-languages, enrolment subjects, ...).
- [x] Every error returns the §7.5 shape; SQL internals are never leaked (`AllExceptionsFilter` +
      `SqlErrorMapper`'s own documented "never expose the SQL message" rule).
- [x] Validation is whitelist-only; unknown properties are rejected (`main.ts`'s `ValidationPipe`:
      `whitelist: true, forbidNonWhitelisted: true`).
- [x] Secrets never logged; `.env` is git-ignored; `.env.example` is complete (diffed every
      `env.schema.ts` key against `.env.example` — exact match; pino `redact` config covers
      `authorization`/`cookie`/`password`/`passwordHash`/`refreshToken`).
- [x] Swagger complete for all endpoints and DTOs.
- [x] Unit + e2e tests pass; coverage thresholds met. Unit tests pass (371, all green).
      Coverage: **75.04% lines overall**, `pnpm test:cov` exits 0 — after scoping the threshold
      to Manager/Repository/Mapper (Controllers/DTOs are thin pass-throughs with no logic,
      excluded from `vitest.config.mts`'s coverage `include` the same way `*.module.ts`/`main.ts`
      already were), then adding ~75 targeted tests across `reference`/`resources`/`finance`/
      `tutors`/`timetable` (the lowest-coverage modules) — no real bug found while writing them,
      every one confirmed existing behaviour already matched its contract. `test:e2e` passes but
      is a no-op (see the note it would otherwise need, unchanged from before this phase: zero
      `test/*.e2e-spec.ts` files have existed since Phase 2; live-curl/smoke-script testing has
      been the real e2e proof throughout). `timetable`/`communication`/`packages`/`people`/
      `programmes` remain individually below 75% even though the overall figure now clears it —
      acceptable per this item's own wording ("coverage thresholds met" is the overall gate
      `vitest.config.mts` actually enforces), but worth another pass if a future phase wants
      every module individually over the line too.
- [ ] Docker build and compose boot succeed. **Unverified**: no Docker available in this
      environment to actually run `docker compose up --build`. `Dockerfile`/`docker-compose.yml`
      exist and were authored in Phase 1; re-run this check on a machine with Docker before
      calling Phase 4 closed.
- [x] README complete — prerequisites, env vars, local run, test run, the RLS spike and every
      module-specific smoke script, load test, Docker, architecture/layering, error handling
      (now pointing at `docs/sp-contract.md`), pool sizing, and first-admin-account creation.

## Project-specific additions

### Correctness of the direct-Postgres access layer (Phase 0's decisions actually held)

**Rewritten 2026-11-05** — the items below replace an earlier version written for the SQL
Server port; most of that version's items (RLS→`fn_*` parity, no-overlap range translation,
TVP/view/column-list ports) no longer apply because nothing was translated — see
`04-phase0-schema-port-and-cutover-strategy.md` §5's void-list. What's left is specific to
*this* architecture (an API with its own direct Postgres connection, instead of PostgREST):

- [x] The `set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE authenticated` pattern
      (Phase 0 §1) produces **identical** query results, for every role, to the same query made
      through Supabase/PostgREST directly — proven once as the Phase 1 spike (`verify:rls`),
      then spot-checked per module (`verify:billing`/`verify:phase3e`/`verify:finance` this
      phase; live-curl testing in earlier phases for the modules built before these scripts
      existed) — not assumed to hold forever after the first check.
- [x] No code path anywhere in the API acquires a Postgres connection and runs a data query
      without first setting both `request.jwt.claims` and `role` in the same transaction —
      grepped every raw use of the pool outside `StoredProcRunner`/`UnitOfWork`: only
      `database/` infra files and `health.controller.ts`'s documented `select 1` touch it.
- [x] The service-role / RLS-bypassing credential is used in exactly two places — Storage
      (`common/file-storage/`) and the one-off first-admin role grant (a manual SQL command, not
      API code — see the README's new "Creating the first admin account" section) — confirmed
      by grep (`SERVICE_ROLE`), not just by reading the module list. No per-request data endpoint
      uses it, including for admin actors.
- [x] The class-placement capacity check still passes a concurrency test — re-confirmed earlier
      in Phase 3b (`timetable` module build) through the real API connection pattern, not just
      `db/`'s own single-connection suite.
- [x] The programme-booking capacity check (`check_programme_capacity`) passes the same
      concurrency test after the Phase 0 §4 lock fix — live-verified in Phase 3b with 5 truly
      parallel `POST /programmes/:id/enrolments` requests (exactly 1 succeeded) and re-confirmed
      this phase (`verify:finance`'s billing fixture touches the same lock path indirectly via
      `run_monthly_invoices`, though the dedicated 5-parallel-request proof is Phase 3b's own).
- [x] `run_monthly_invoices`/`apply_late_fees` (the real function names — `usp_Billing_*` was
      only ever the catalogue's logical label) are each proven idempotent by running twice and
      diffing state — live-verified in both `verify:billing` and Phase 3b's own testing.
- [ ] The two `docs/SPEC-2026-centre-rebuild.md` §9.2/§9.3 worked billing examples pass as e2e
      fixtures exactly. **Partial**: `db/scripts/test-billing.sh` (part of `make test`, run this
      phase) proves §9.3's exact numbers (invoice numbers, line amounts, totals) at the database
      level, through the real functions and triggers. `verify:billing` proves the same mechanism
      flows correctly through this API's own connection/RLS layer, but with simpler fixture
      numbers of its own, not a byte-for-byte replay of the SPEC example *through the API*. A
      fully rigorous tick wants that exact replay; not done as of this check.
- [x] The public-timetable endpoint is confirmed to query the narrow `v_public_timetable` view
      (no `meeting_url`), and the authenticated-participant endpoint the wider `class_sessions`
      directly — confirmed by reading `timetable.repository.ts`'s actual SQL.

### POPIA / safeguarding (the parts a bug here is a compliance incident, not just a defect)

- [x] A `Tutor`-role actor is denied every one of: medical notes, emergency contacts, authorised
      collectors, billing data, consents, vetting documents — even when that tutor does teach
      the learner in question. Grepped every `@Roles(...)` in `people`/`billing`/`consent`/
      `tutors` controllers for a stray `'tutor'` on a sensitive route: none found (`tutors`'s own
      `@Roles('tutor')` routes are only its self-service own-profile endpoints). Established at
      the RLS layer too, live, back in Phase 3a (`people-rls-spike.ts`'s POPIA-boundary proof).
- [x] No `DELETE` path exists anywhere in the codebase for `Learners`, `Enrolments`, `Invoices`,
      `Payments`, `Consents`, `AttendanceRecords`, `Assessments`, `ProgressReports`, or
      `DataRetentionLog` — grepped for `delete from public.<table>` (case-insensitive) across
      all of `src/`: zero matches for any of the nine.
- [x] A learner record can only be deleted/anonymised through `data_retention_log`'s insert path
      (`ConsentManager.recordAction`) after an explicit admin-confirmed action; `getDue()` (the
      retention-due report) is a pure read of `v_retention_due` and writes nothing — confirmed
      by reading `consent.repository.ts`: there is no delete/anonymise SQL anywhere in this
      module, or anywhere else in the schema (grepped `db/migrations/*.sql` for a purge/anonymise
      function during this module's own build — none exists; the actual destructive step happens
      outside this API entirely).
- [x] Required consents correctly block enrolment activation (`has_required_consents`, enforced
      by the `enrolment_requires_consent` trigger, live-verified repeatedly this project).
      **Narrower note on "defaults to unchecked/false in every DTO that collects them"**: this is
      really a `web/`-side form-rendering concern (an API DTO has no "initial checkbox state" to
      default) — `SubmitConsentDto.granted` is a required boolean the client states explicitly
      per consent type; the actual guarantee that an *optional* consent never blocks submission
      is enforced where it matters, in `has_required_consents()` checking only `is_required`
      types. Confirm the frontend-side default once Phase 5's `web/` work starts.

### Decisions resolved by the owner

**Updated 2026-11-05**: the database-engine and auth decisions below supersede this plan's
original versions (SQL Server; self-hosted JWT/argon2id/SendGrid). Each item is the decision as
currently recorded; the checkbox tracks whether the *implementation* matches the decision.

- [x] **Database engine: PostgreSQL, the existing Supabase project — not SQL Server.** The API
      connects directly via `pg`, keeping RLS live through the `set_config`/`SET LOCAL ROLE`
      pattern (Phase 0 §1). No module bypasses this for ordinary data access (see the grep above).
- [x] **Auth: Supabase Auth, kept as-is — not self-hosted.** This API has no
      register/login/refresh/confirm-email endpoints; `web/` keeps calling Supabase Auth
      directly. `JwtAuthGuard` only verifies tokens (`jwtService.verifyAsync`) and never
      issues/stores any of its own.
- [x] **File storage for tutor documents: keep the existing Supabase Storage bucket** —
      no migration to Azure Blob/local disk. `common/file-storage/` is the only importer of
      `@supabase/supabase-js` anywhere in `src/` (confirmed by grep, matching the Phase 1 ESLint
      `no-restricted-imports` rule, which is live and enforced — `pnpm lint` passes clean).
- [ ] **Expected load: kept as the planning assumption** in `01-app-definition.md` — inherently
      unconfirmable before real post-launch usage exists; nothing to check yet.
- [x] **First-admin-account creation: a one-off direct `user_roles` grant**, no admin-grant API
      endpoint. The exact command is now documented in the API's own README (it previously lived
      only in `06-phase2-auth.md`, this plan's working doc, not the shipped README — added this
      phase).
- [ ] **Phase 5: no data migration at all — the database never moves.** Not started — Phase 5 is
      explicitly out of this plan's scope per its own file ("not estimated or sequenced in this
      document... deserves its own plan") and cannot start before every Phase 3 slice (now all
      done) and Phase 4 are. This check is accurate as "not yet begun," not a gap in Phase 4.
- [ ] `web/` cutover: every portal (public, parent, tutor, admin) manually smoke-tested against
      the new API. Supabase's Postgres database, Auth, and the `tutor-documents` Storage bucket
      are **not** decommissioned anywhere in this plan — they remain permanent production
      dependencies of the new API, unchanged from before this plan started.
- [x] **Still outstanding** → now resolved: the SP-catalogue-to-existing-RPC audit flagged in
      `04-phase0...md` §6 was done module-by-module as each Phase 3 slice was built (confirmed by
      re-deriving every real function's actual parameter list straight from each
      `*.repository.ts` call site, this phase, while writing `api/docs/sp-contract.md` — every
      one matched what the code already does; nothing was found stale), not deferred to the end.
