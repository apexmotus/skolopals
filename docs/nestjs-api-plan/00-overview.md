# Skolopals API Rebuild — Implementation Plan Overview

## What this is

This plan fills in `nestjs-api-implementation-spec.md` (the generic NestJS implementation spec
at the repo root) for the **Skolopals** tutoring-centre system, and sequences the work of
**placing a standalone NestJS API in front of the existing Supabase Postgres database**
(`skolopals/db/`, currently consumed directly by the Next.js app in `skolopals/web/` via
`@supabase/supabase-js`), so that `web/`'s data access goes through a proper layered API instead
of client-side RPC/table calls, per the generic spec's hard rules (no ORM, no inline SQL,
controller → manager → repository → `StoredProcRunner` only).

**Superseded 2026-11-05: this is no longer a SQL Server migration.** An earlier version of this
plan replaced the Postgres/Supabase backend with a standalone SQL Server instance. The owner
reversed that: **the database stays Supabase Postgres, and Supabase Auth stays too** — only the
`web/`-to-database access path changes, from direct `@supabase/supabase-js` calls to a NestJS API
in between. `04-phase0-schema-port-and-cutover-strategy.md` now documents this (renamed in
content, not in filename, to avoid renumbering every other file) — read it before anything else
below, since every later phase file still contains some SQL-Server-era language that file's §5
explicitly voids.

This is a **data-access-layer insertion**, not a backend replacement and not a greenfield build.
Two things follow from that, and both still make this plan different from a blank application of
the generic spec:

1. **Section 1 of the generic spec (app identity, modules, endpoints, SP catalogue, business
   rules) is derived from the existing Postgres schema and the RPC functions it already
   exposes**, not invented. The 23 migrations in `db/migrations/` and the `.rpc()` / `.from()`
   calls in `web/src/` are the source of truth, and — unlike the SQL Server version of this plan —
   many of the "stored procedures" this catalogue calls for **already exist** as Postgres
   functions; this project's Phase 0 task is partly an audit against what's already there, not
   a from-scratch design. See `01-app-definition.md`, `02-sp-catalogue.md`,
   `03-endpoints-and-business-rules.md`, and `04-phase0...md` §6's note on the still-outstanding
   audit.
2. **The adaptation the generic spec doesn't anticipate is now much smaller than it was under
   the SQL Server plan**: Postgres's RLS, triggers, exclusion constraints, and `jsonb`/array
   parameters all stay exactly as they are — nothing to translate. The one genuinely new
   mechanic is making the NestJS API's direct Postgres connection respect RLS the same way
   PostgREST does today (`set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE authenticated`
   per request), and swapping the generic spec's SQL-Server-literal database layer (`mssql`,
   `StoredProcRunner`, TVPs) for a Postgres equivalent. Both are designed once, in
   `04-phase0-schema-port-and-cutover-strategy.md`.

## Provenance

This plan was produced by two independent passes over the same source material (the 23
migrations in `db/migrations/` and every `.rpc()`/`.from()` call in `web/src/`), then merged and
cross-checked against that source material a third time before being finalized here. The merge
corrected two concrete errors that had crept into the independent drafts — both drafts
independently and incorrectly claimed Postgres's `check_programme_capacity` trigger takes a row
lock before counting (it doesn't; see `04-phase0...md` §4). Treat this file set as the current,
correct version; no other plan directory for this migration should exist alongside it.

**2026-11-05 — SQL Server dropped, Postgres/Supabase kept.** The plan originally called for
porting the schema to SQL Server; that decision is reversed (see "What this is" above and
`04-phase0...md`). Files below still contain some phrasing written for the SQL Server version
(SP names like `usp_X_Y`, `nvarchar`/`uniqueidentifier`/`datetime2` types, `THROW`/`UPDLOCK`
syntax, TVP parameters) — where a file hasn't been fully reworded yet, read it as: the
business rule or endpoint described is still correct, the *dialect* it's written in is not.
`02-sp-catalogue.md` and `03-endpoints-and-business-rules.md` carry an explicit note on this;
treat full line-by-line renaming to match the actual existing Postgres function names as part of
the still-outstanding audit in `04-phase0...md` §6, not as done.

## File map

| File | Content |
|---|---|
| `01-app-definition.md` | Generic spec §1.1–1.4: identity, options, auth model, module list |
| `02-sp-catalogue.md` | Generic spec §1.6: every stored procedure/function, naming, params |
| `03-endpoints-and-business-rules.md` | Generic spec §1.5 + §1.7: endpoints and business rules, per module |
| `04-phase0-schema-port-and-cutover-strategy.md` | **New phase, rewritten 2026-11-05.** Direct-Postgres-connection + RLS strategy, Supabase Auth JWT verification, the one real schema bug fix needed regardless of engine |
| `05-phase1-scaffold-infrastructure.md` | Generic spec Phase 1 |
| `06-phase2-auth.md` | Generic spec Phase 2 |
| `07-phase3a-reference-people-tutors.md` | Generic spec Phase 3, slice A |
| `08-phase3b-packages-enrolment-timetable-programmes.md` | Generic spec Phase 3, slice B |
| `09-phase3c-assessment-progress.md` | Generic spec Phase 3, slice C |
| `10-phase3d-billing.md` | Generic spec Phase 3, slice D |
| `11-phase3e-communication-enquiries-resources-reviews-consent.md` | Generic spec Phase 3, slice E |
| `12-phase3f-finance-kpis-reporting.md` | Generic spec Phase 3, slice F |
| `13-phase4-hardening-docs.md` | Generic spec Phase 4 |
| `14-phase5-data-migration-and-cutover.md` | **New phase.** Moving real data, switching the Next.js app over, rollback |
| `15-acceptance-checklist.md` | Generic spec §13.5, expanded for this project |

## Phase order and dependency rule

Phases must run in this order. A phase is not "done" until its own verification step passes
(stated inside each file) — per the generic spec's rule 0.1.9.

```
Phase 0  Direct-Postgres/RLS strategy  (no code; decisions + one bug-fix migration)
Phase 1  Scaffold & infrastructure
Phase 2  Auth (JWT verification against Supabase Auth — no login/register/refresh built here)
Phase 3a Reference + People + Tutors    (everything else depends on these)
Phase 3b Packages + Enrolment + Timetable/Attendance + Programmes
Phase 3c Assessment + Progress
Phase 3d Billing
Phase 3e Communication + Enquiries + Resources + Reviews + Consent/Retention
Phase 3f Finance KPIs + reporting views
Phase 4  Hardening & docs
Phase 5  Cutover (switch web/'s data access from direct Supabase calls to this API; Supabase
         Postgres + Auth + Storage all stay — see `14-phase5-data-migration-and-cutover.md`)
```

3a before 3b: enrolment needs learners, guardians and tutor competencies. 3b before 3c/3d:
assessments and billing both reference enrolments and class placement. 3e and 3f have no
downstream dependents and can be reordered against each other if priorities change, but both
depend on 3a–3d existing.

## Decisions already made for you (don't re-derive these)

These came out of reading the existing schema, not from the owner, and are marked as
**assumptions** inline where they first matter. Revisit them with the owner before Phase 0 is
considered final:

- **Expected load** (generic spec §1.1): not stated anywhere in the business plan or the
  current app. Assume a single physical centre's worth of traffic — on the order of a few
  hundred registered accounts, low tens of concurrent users at peak (drop-off/pickup times,
  the 15th-of-month billing run, start-of-term enrolment rush). This is a guess; confirm with
  the owner before sizing `DB_POOL_MAX` against Supabase's connection limit for real.
- **Background jobs (BullMQ): no.** The two "batch" operations (`run_monthly_invoices`,
  `apply_late_fees`) are admin-button-triggered today (`web/src/app/admin/billing/actions.ts`),
  not cron jobs. The plan keeps them as synchronous admin-triggered endpoints. Scheduling them
  automatically is a documented option in `10-phase3d-billing.md`, not a requirement.
- **File uploads: yes, existing Supabase Storage bucket kept, unchanged by the SQL-Server
  reversal** — tutor vetting documents (ID, qualifications, police clearance, CV) stay on the
  existing private Supabase Storage bucket; see `04-phase0...md` §3. The API calls out to it
  through a narrow `FileStorageService` wrapper, now pointed at the same Supabase project as the
  main DB connection.
- **Multi-tenant: no.** One centre, no tenant resolution needed.
- **Redis caching: yes**, for public/slow-moving reference data and the tutor directory. See
  `03-endpoints-and-business-rules.md` for the exact cacheable list per module.
- **Auth: Supabase Auth, kept as-is (decided 2026-11-05, superseding the self-hosted-JWT plan
  below).** No `Users`/`RefreshTokens` tables, no argon2id, no SendGrid confirmation flow — all
  of that was only needed under the SQL Server plan, which had no managed auth service left.
  Supabase Auth already does registration, login, email confirmation, password hashing and
  refresh-token rotation; the API only verifies the JWTs it issues. See `04-phase0...md` §2 and
  `06-phase2-auth.md`.
- **Password reset is not built, because it doesn't exist today either.** Verified against
  `web/src/app/(auth)/` — there is no "forgot password" flow in the current frontend, even
  though Supabase Auth supports one. Flagged as a pre-existing gap, not a regression introduced
  by this plan, and not affected one way or the other by the SQL-Server reversal.
- **First admin account: a one-off direct role grant (decided 2026-11-05, simplified by the
  reversal).** `public.user_roles` gets the `admin` row inserted directly once, same as today —
  no new seed-script design needed, since this was never blocked on the SQL Server port. See
  `04-phase0...md` §2.
- **Phase 5 cutover: no data migration at all.** The database never moves — it's the same
  Supabase Postgres project throughout. Phase 5 is `web/`'s data-access switch from direct
  Supabase calls to this API, nothing else. See `14-phase5-data-migration-and-cutover.md`.

## Stop conditions carried over from the generic spec

Per generic spec §0.2, work must stop and the owner must be asked if, during implementation:

- A stored procedure's result shape can't be pinned down from the current RPC/query (none
  identified during this planning pass — flag immediately if one turns up).
- The `set_config`/`SET LOCAL ROLE` pattern in `04-phase0...md` §1 turns out not to make RLS
  behave identically to PostgREST's enforcement once tested against a real query — this is the
  one genuinely new, unproven mechanic in the whole plan and the thing most worth stopping on if
  it doesn't hold.
- The Supabase project's direct-connection details or JWT secret are missing when Phase 1 starts
  (unlikely — the project already exists and is in active use — but confirm before Phase 1, not
  during it).
