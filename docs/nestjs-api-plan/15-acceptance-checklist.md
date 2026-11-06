# Final Acceptance Checklist

Expands generic spec §13.5 for this project. Nothing here is complete until every box in the
generic spec's own checklist AND every box below is ticked.

## Generic spec §13.5 (carried over, unchanged)

- [ ] No `<<FILL>>` item was guessed; every endpoint and SP traces back to Section 1 — for this
      project, traces back to `01-app-definition.md` / `02-sp-catalogue.md` /
      `03-endpoints-and-business-rules.md`, which themselves trace back to `db/migrations/` and
      `web/src/` call sites, not invention.
- [ ] No ORM, no inline SQL (other than `SELECT 1`), no `any`, no `@ts-ignore`.
- [ ] Controllers contain no logic; Managers contain no HTTP/SQL knowledge; Repositories
      contain no business logic.
- [ ] Every SP parameter uses an explicit SQL type and length matching the catalogue.
- [ ] All multi-SP writes use `UnitOfWork` and sequential awaits.
- [ ] Every error returns the §7.5 shape; SQL internals are never leaked.
- [ ] Validation is whitelist-only; unknown properties are rejected.
- [ ] Secrets never logged; `.env` is git-ignored; `.env.example` is complete.
- [ ] Swagger complete for all endpoints and DTOs.
- [ ] Unit + e2e tests pass; coverage thresholds met.
- [ ] Docker build and compose boot succeed.
- [ ] README complete.

## Project-specific additions

### Correctness of the direct-Postgres access layer (Phase 0's decisions actually held)

**Rewritten 2026-11-05** — the items below replace an earlier version written for the SQL
Server port; most of that version's items (RLS→`fn_*` parity, no-overlap range translation,
TVP/view/column-list ports) no longer apply because nothing was translated — see
`04-phase0-schema-port-and-cutover-strategy.md` §5's void-list. What's left is specific to
*this* architecture (an API with its own direct Postgres connection, instead of PostgREST):

- [ ] The `set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE authenticated` pattern
      (Phase 0 §1) produces **identical** query results, for every role, to the same query made
      through Supabase/PostgREST directly — proven once as the Phase 1 spike, then spot-checked
      per module during Phase 3 as each module's own verification step, not assumed to hold
      forever after the first check.
- [ ] No code path anywhere in the API acquires a Postgres connection and runs a data query
      without first setting both `request.jwt.claims` and `role` in the same transaction —
      grep for every raw use of the pool outside `StoredProcRunner` to confirm there isn't a
      shortcut path that bypasses this.
- [ ] The service-role / RLS-bypassing credential is used in exactly two places — Storage
      (`common/file-storage/`) and the one-off first-admin role grant — confirmed by grep, not
      just by reading the module list. No per-request data endpoint uses it, including for
      admin actors (Phase 0 §1).
- [ ] The class-placement capacity check still passes a concurrency test (N parallel requests,
      exactly 1 succeeds against a capacity-1 resource) — this was already fixed in the current
      Postgres schema (`check_class_capacity`, confirmed via `FOR UPDATE`); re-confirm it still
      holds when called through the new API's connection pattern, not just when called directly.
- [ ] The programme-booking capacity check (`check_programme_capacity`) passes the same
      concurrency test **after** the Phase 0 §4 lock fix is applied — before the fix, this test
      is expected to fail (two concurrent bookings both succeed against a capacity-1 programme);
      confirm the fix migration actually landed, not just that it was designed.
- [ ] `usp_Billing_RunMonthlyInvoices`/`usp_Billing_ApplyLateFees` (or whatever their actual
      Postgres function names turn out to be per the Phase 0 §6 audit) are each proven
      idempotent by running twice and diffing state.
- [ ] The two `docs/SPEC-2026-centre-rebuild.md` §9.2/§9.3 worked billing examples pass as e2e
      fixtures exactly (invoice numbers, line amounts, totals, due dates).
- [ ] The public-timetable endpoint is confirmed to query the narrow `v_public_timetable` view
      (no `meeting_url`), and the authenticated-participant endpoint the wider one — confirmed
      by reading the actual SQL each Manager method sends, not by trusting the endpoint name.

### POPIA / safeguarding (the parts a bug here is a compliance incident, not just a defect)

- [ ] A `Tutor`-role actor is denied, by Manager-level test, every one of: medical notes,
      emergency contacts, authorised collectors, billing data, consents, vetting documents —
      even when that tutor does teach the learner in question.
- [ ] No `DELETE` path exists anywhere in the codebase for `Learners`, `Enrolments`, `Invoices`,
      `Payments`, `Consents`, `AttendanceRecords`, `Assessments`, `ProgressReports`, or
      `DataRetentionLog` — confirmed by grep, not just by reading the endpoint tables.
- [ ] A learner record can only be deleted/anonymised through `usp_DataRetentionLog_Create`
      after an explicit admin confirmation action; the retention-due report itself writes
      nothing.
- [ ] Required consents correctly block enrolment activation; optional consents correctly do
      not, and default to unchecked/false in every DTO that collects them.

### Decisions resolved by the owner

**Updated 2026-11-05**: the database-engine and auth decisions below supersede this plan's
original versions (SQL Server; self-hosted JWT/argon2id/SendGrid). Each item is the decision as
currently recorded; the checkbox tracks whether the *implementation* matches the decision.

- [ ] **Database engine: PostgreSQL, the existing Supabase project — not SQL Server.** The API
      connects directly via `pg`, keeping RLS live through the `set_config`/`SET LOCAL ROLE`
      pattern (Phase 0 §1). Confirm no module bypasses this for ordinary data access.
- [ ] **Auth: Supabase Auth, kept as-is — not self-hosted.** This API has no
      register/login/refresh/confirm-email endpoints; `web/` keeps calling Supabase Auth
      directly. Confirm `JwtAuthGuard` only verifies tokens and never issues/stores any of its
      own (Phase 0 §2, `06-phase2-auth.md`).
- [ ] **File storage for tutor documents: keep the existing Supabase Storage bucket** —
      no migration to Azure Blob/local disk, unaffected by the database/auth reversal. Confirm
      `common/file-storage/` only ever talks to Supabase via the service-role key, and that no
      other module imports `@supabase/supabase-js` directly (per the Phase 1 ESLint rule) — see
      Phase 0 §3 and `05-phase1-scaffold-infrastructure.md`.
- [ ] **Expected load: kept as the planning assumption** in `01-app-definition.md` (low hundreds
      of accounts, low tens of concurrent peak users, single instance, `DB_POOL_MAX=20` sized
      against Supabase's own connection limit). Confirm this still looks right once real usage
      is observed post-launch.
- [ ] **First-admin-account creation: a one-off direct `user_roles` grant**, no admin-grant API
      endpoint. Confirm the exact command is documented in the README — see `06-phase2-auth.md`.
- [ ] **Phase 5: no data migration at all — the database never moves.** Confirm `web/`'s
      switch-over is complete (no remaining direct `.rpc()`/`.from()` calls for data the API
      now owns) — see `14-phase5-data-migration-and-cutover.md`.
- [ ] `web/` cutover: every portal (public, parent, tutor, admin) manually smoke-tested against
      the new API. Supabase's Postgres database, Auth, and the `tutor-documents` Storage bucket
      are **not** decommissioned anywhere in this plan — they remain permanent production
      dependencies of the new API, unchanged from before this plan started.
- [ ] **Still outstanding**: the SP-catalogue-to-existing-RPC audit flagged in
      `04-phase0...md` §6 is complete for every module before that module's Phase 3 slice is
      called done — not deferred to the very end of Phase 3f.
