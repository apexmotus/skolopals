# Phase 0 — Postgres/Supabase Direct-Access Strategy

**Superseded 2026-11-05: SQL Server is dropped.** The owner decided to keep the existing
Supabase Postgres project (`db/`, schema already built across phases 0–7, already live-tested —
159 assertions passing per `make reset`) as the database, and keep Supabase Auth, rather than
porting to a standalone SQL Server instance. This file replaces the original Phase 0 entirely —
it no longer designs a translation layer, because there is nothing to translate: the NestJS API
is being placed **in front of** the schema that already exists and already works, not rebuilding
it on a different engine.

This is a smaller phase than the one it replaces. Most of what the SQL Server version of this
file had to design from scratch — RLS→helper-function translation, no-overlap ranges,
`generate_series`, deferred constraint triggers, generated columns, the public-timetable security
boundary, timezone handling, ISO day-of-week — **Postgres already does natively and correctly,
because this schema is where those features came from in the first place.** Section 1 below
states this explicitly, file by file, so nothing from the old plan is silently assumed to still
need work it no longer needs.

**Verify this phase by review, not tests**: have the owner read and sign off this file before
Phase 1 starts, same rule as before.

## 0. What changed, and why it's less work, not a wash

The generic spec (`nestjs-api-implementation-spec.md`) is written SQL-Server-literal in its
database layer (§5: `mssql` driver, `sql.TVP`, `StoredProcRunner` built around `mssql.Request`)
and Docker setup (§11.4: `mcr.microsoft.com/mssql/server`). None of that code applies now. What
**does** still apply, unchanged, is the generic spec's layering contract — Controller → Manager →
Repository → `StoredProcRunner` → database, no ORM, no inline SQL outside a health check, no
business logic in Controllers or SQL knowledge in Managers. Phase 1 adapts the generic spec's
database-layer *code* to Postgres; it does not relax the *architecture*.

The previous SQL-Server plan's single biggest flagged risk — "there is no database-level RLS
backstop in the new architecture; row-level authorization bugs are now only caught by code
review" — **does not apply here**. The owner confirmed (see root conversation, 2026-11-05):
**keep RLS as the real authorization backstop**, connecting per-request as the authenticated
Postgres role, the same way PostgREST does today. This is a net risk reduction relative to the
SQL Server plan, not a consolation prize — the existing RLS policies are already written, already
tested, and this plan does not touch them.

## 1. Database connection: direct Postgres, not PostgREST, keeping RLS live

**What stays exactly as today**: the Supabase project (`dhmjzshlznhqohvkdcpz` per project memory
— reconfirm this is still the right project id before Phase 1), its schema, its RLS policies, its
`private.*` helper functions, its triggers, its views. Nothing here is rebuilt.

**What's new**: the NestJS API gets its own direct Postgres connection (via `pg`/node-postgres,
using Supabase's direct connection string — port 5432, session mode, *not* the `6543` transaction
pooler, for the reason below) instead of `web/` talking to Supabase through
`@supabase/supabase-js` and PostgREST. The API becomes the thing that calls the RPC functions;
`web/` calls the API instead of calling Supabase directly for data (Storage access is a separate,
unchanged exception — see §2).

**The one real new mechanic this requires**: PostgREST enforces RLS today by setting two
session-scoped GUCs before running a user's query — the Postgres role (`SET ROLE authenticated`)
and the decoded JWT claims (`request.jwt.claims`, which Postgres's built-in `auth.uid()` /
`auth.jwt()` helpers read). The NestJS API must reproduce exactly this, per request, or RLS has
nothing to key off and either blocks everything or (worse, if connecting as a superuser/service
role by mistake) sees everything:

```sql
-- inside the same transaction as the actual query, as the FIRST statements:
select set_config('request.jwt.claims', $1, true); -- $1 = JSON-encoded decoded JWT claims
set local role authenticated;
-- ... the actual SELECT/INSERT/UPDATE/CALL goes here, same transaction ...
```

- **`set_config(..., true)` and `SET LOCAL ROLE`, never the session-level forms.** The `true`
  third argument and `LOCAL` keyword both scope the setting to the current transaction only —
  critical, because `pg.Pool` hands physical connections back to the pool for reuse across
  unrelated requests, and a session-level `SET ROLE` would leak into the next request served by
  that connection. This is the one subtle bug this pattern can introduce that the old SQL Server
  plan never had to think about at all; flag it in code review on every PR that touches
  `database/`.
- **Every query now runs inside an explicit transaction, including reads** — a real deviation
  from the generic spec's implied pattern (where a plain read didn't need `UnitOfWork`). Here,
  `StoredProcRunner` itself must always: acquire a connection, `BEGIN`, set the two GUCs, run the
  call, `COMMIT`, release — for every single call, read or write. This is a required change to
  the generic spec's §5 `StoredProcRunner`/`UnitOfWork` code for this project; document it
  prominently in Phase 1 so nobody "simplifies" reads back to a bare pooled query later and
  silently disables RLS for every GET endpoint.
- **Service-role bypass stays narrowly scoped to what already uses it today**: the Storage
  `FileStorageService` (§2) and the one-off first-admin-role-grant script (§3) are the only two
  places that should ever use the Supabase service-role key / a role that bypasses RLS. Every
  per-request data call goes through the `authenticated`-role + JWT-claims pattern above, even
  for admin actors — an admin actor's elevated access is expressed by their JWT claims matching
  what the existing RLS policies already check (`private.is_admin()`), not by the API using a
  different, more powerful Postgres role for admin requests. This preserves the actual security
  property RLS gives you; routing admin traffic through a bypass role would recreate the "no
  backstop" risk for exactly the actor who can see the most sensitive data.
- **Connection pool sizing**: `DB_POOL_MAX` now bounds a pool of direct Postgres connections
  against Supabase's own connection limit (visible in the Supabase dashboard for this project),
  not an SA-managed SQL Server budget. Confirm this limit before sizing — Supabase's pooler
  (`pgbouncer`, port 6543) is deliberately **not** used here, because transaction-mode poolers
  hand out a fresh backend per transaction and have known caveats with session-level GUCs and
  prepared statements; the direct/session connection on 5432 is the correct choice for this
  pattern even though it doesn't scale as wide. At the "low tens of concurrent users" load
  already assumed in `01-app-definition.md`, this is not a real constraint.

## 2. Auth: keep Supabase Auth, verify its JWTs

**Decided 2026-11-05, superseding the old Phase 0 §1 entirely.** There is no `dbo.Users` /
`dbo.RefreshTokens` port, no argon2id, no SendGrid confirmation flow, no self-hosted login/
register/refresh endpoints in this API at all. Supabase Auth keeps doing exactly what it does
today: `auth.users`, email confirmation, password hashing, session/refresh tokens. `web/` keeps
calling Supabase Auth directly (via `@supabase/supabase-js`, same as today) for
register/login/logout/refresh/password-reset-if-ever-built; only the **data** endpoints move to
the new NestJS API.

**What the API actually needs to build** (replacing the old Phase 2's Users/RefreshTokens work
entirely): a `JwtAuthGuard` that verifies the JWT Supabase already issued, using
`SUPABASE_JWT_SECRET` (HS256, the project's JWT secret from the Supabase dashboard — treat this
with the same care as a DB password) — no `/auth/*` endpoints of its own except `GET /auth/me`
as a thin convenience wrapper over `usp_User_GetById`-equivalent (optional; `web/` may not even
need it since it already has the decoded JWT from Supabase). Roles still come from
`public.user_roles` exactly as today, read via the same RLS-respecting connection as everything
else (no special-casing roles as a bypass-role lookup) — the JWT's own claims may already carry
roles if the existing Postgres trigger/hook populates them into the token; confirm this against
`db/migrations/` during Phase 1 rather than assuming either way.

**This also means**: the decoded JWT's `sub` claim (the Supabase `auth.users.id`, a `uuid`) is
exactly the identifier value that gets passed into `set_config('request.jwt.claims', ...)` in §1
— the API is not minting its own user identity, it's forwarding Supabase's.

**First admin account**: unchanged in spirit from the old plan — still a one-off action, not a
self-service endpoint — but the mechanism is simpler now: grant the `admin` row in
`public.user_roles` directly (SQL, via the Supabase dashboard or a one-off script using the
service-role key), exactly how this is already done today per project memory. No new seed script
design is needed; this was never blocked on the SQL Server port in the first place.

**Password reset**: unchanged conclusion from the old plan — out of scope, because it doesn't
exist in the current app today either (Supabase Auth supports it; `web/`'s UI never exposed it).
Still worth flagging to the owner as a pre-existing gap, independent of this migration.

## 3. File storage (tutor vetting documents) — unchanged, and now trivially simpler

**Still decided: keep Supabase Storage.** This was never contingent on the SQL Server choice —
it was already an exception carved out from "replace Supabase entirely." It gets *simpler* now
rather than staying merely unchanged: the API's `FileStorageService` and its direct-Postgres
connection are both pointed at **the same Supabase project**, so there's one
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` pair to manage instead of a Postgres-connection-string
plus a separate Supabase-for-Storage-only credential pair. The service-role key remains scoped
to exactly two things: `common/file-storage/` (signed URLs for the `tutor-documents` bucket) and
the one-off first-admin-grant script (§2) — never used for ordinary per-request data access,
per §1's bypass-scoping rule.

## 4. The capacity-lock bug — still real, still the top risk, now fixed with native Postgres locking

**This section survives from the old plan almost unchanged, because it was never a SQL-Server-
translation problem — it's a bug in the schema that exists today, independent of what engine
sits underneath it.** Restating the finding precisely, since it's easy to mis-remember as "the
SQL Server port introduces a new fix" when actually it's "this Postgres schema has had this bug
the whole time, port or no port":

- `check_class_capacity()` (`db/migrations/20261020000006_timetable_attendance.sql`) **already
  takes `FOR UPDATE` before counting** — already fixed, already verified by `make reset`'s 159
  assertions, per project memory. No action needed; this one's just correct today.
- `check_programme_capacity()` (`db/migrations/20261020000009_programmes.sql`) **does not**
  take a lock before counting — confirmed by grepping that file for `for update` and finding
  nothing. This is the exact same race condition class that `check_class_capacity` had before it
  was fixed: two concurrent programme bookings into a near-full programme can both read the same
  stale count under `READ COMMITTED` and both pass, oversubscribing the programme. It has simply
  never been hit in practice because programme bookings are low-volume.

**Action for this phase**: write (or have the owner approve) a small migration that adds the
missing lock to `check_programme_capacity()`, mirroring `check_class_capacity()`'s existing
pattern — `perform 1 from programme_sessions where ... for update` (or the equivalent explicit
row lock on the programme/session being booked into) as the trigger's first statement, before the
count check. This is a direct fix to the live schema, independent of the NestJS API build, and
arguably should land before Phase 1 even starts since it's a correctness bug in production-bound
code regardless of which API sits in front of it. `usp_Invoice_NextNumber`'s sequence-allocation
race (Postgres currently protects this via `INSERT ... ON CONFLICT DO UPDATE`, per the original
finding) stays as-is — that mechanism is already safe and Postgres-native; no change needed.

Call out in code review, same as the old plan did: don't "fix" this by reverting to match
`check_class_capacity`'s pre-fix behavior under a mistaken idea of parity — the goal is both
triggers behaving like the already-fixed one, not like each other's current (one of them buggy)
state.

## 5. Everything the old SQL-Server Phase 0 had to design that Postgres already does — explicitly voided

Stated once per item so nothing from the superseded plan is carried forward by habit:

| Old Phase 0 section | Why it no longer applies |
|---|---|
| §2 RLS → `fn_*` scalar functions, called explicitly per SP | **Voided.** RLS stays live (§1 above); the existing `private.*` helper functions keep being called *by RLS policies*, not re-invoked explicitly inside every SP. |
| §3 No-overlap ranges (`terms`, `package_prices`, etc.) | **Voided.** `EXCLUDE USING GIST` is a native Postgres feature already in these tables; nothing to port. |
| §4 `generate_series` → numbers table | **Voided.** `generate_series` is native Postgres; no helper table needed. |
| §6 Deferred constraint triggers → end-of-batch SP validation | **Voided.** `CREATE CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` is native Postgres and already in the schema. |
| §7 Generated/computed columns | **Voided.** Already Postgres generated columns in the existing migrations; nothing to re-create. |
| §8 `v_public_timetable` security boundary ("two SPs") | **Voided as a translation problem** — the Postgres view already omits `meeting_url` for anonymous visitors via its own column list, same mechanism as before. The API must still call the narrow view for the public timetable endpoint and the wider one for the authenticated participant endpoint — that routing discipline stays as an implementation rule, it's just not a new translation. |
| §9 Timezone handling (luxon in the Manager layer) | **Voided.** Postgres's `timestamptz` + `AT TIME ZONE 'Africa/Johannesburg'` already works natively (unlike SQL Server, which needed a Windows tz ID). No Manager-layer conversion is required, though the Manager may still choose to do display-formatting in the API's response layer. |
| §10/§14 ISO day-of-week (`DATEPART(ISO_WEEKDAY, ...)`) | **Voided.** `extract(isodow from date)` is already what the schema uses. |
| §12/§16 Type-mapping notes (money as cents, enum-as-check, `iso_dow` domain, `uuid`) | **Voided as a *mapping* problem** — there is no second schema to map to; the existing Postgres types are the API's types. The *conventions themselves* (cents as integer, never float/decimal; domain-based check constraints) still matter as facts worth knowing, they're just not being translated anywhere. |
| §13 SQL Server version requirement | **Voided entirely.** No SQL Server. |
| §15 Views strategy ("recreate every view") | **Voided.** The ~17 Postgres views already exist and already do this derivation work; nothing is recreated. The Manager/SP layer calls them exactly as the existing RPCs already do. |
| §17 "Translated DDL in `db/stubs/`" | **Replaced** by §6 below — there is no DDL to translate; Phase 0's deliverable is the connection/auth pattern and the one real bug fix, not a schema port. |

## 6. What Phase 0 must actually produce, concretely

- This file, reviewed and signed off by the owner.
- The `check_programme_capacity()` lock fix (§4) as a new migration in `db/migrations/`, applied
  and verified by `make reset`.
- A short spike/proof-of-concept (can live in Phase 1's scaffold, doesn't need to predate it) of
  the `set_config`/`SET LOCAL ROLE` pattern in §1 against a real query, confirming RLS actually
  applies through a direct `pg` connection the same way it does through PostgREST today — this is
  the one genuinely new mechanic in this whole pivot and the one thing worth proving early rather
  than discovering wrong three modules into Phase 3.
- Confirmation that the Supabase project id (`dhmjzshlznhqohvkdcpz` per project memory) and its
  direct-connection details (host, port 5432, `SUPABASE_JWT_SECRET`) are in hand before Phase 1
  starts — this is this project's equivalent of the old plan's "real SQL Server hosting target"
  stop condition, and it's already satisfied for local/dev use since the project already exists;
  only double-check nothing has changed since 2026-11-02.
- **Still outstanding, not yet done in this pass**: an audit matching every SP named in
  `02-sp-catalogue.md` against the actual existing Postgres function in `db/migrations/` —
  flagging which already exist and can be called as-is, which need a small signature change, and
  which are genuinely net-new. `02-sp-catalogue.md` now carries a note scoping this; do it before
  treating any Phase 3 slice's SP list as final, module by module, rather than all at once up
  front — the existing `.rpc()` call sites in `web/src/` are the fastest way to confirm a given
  SP already exists and what it's actually called.
