# Phase 1 — Scaffold & Infrastructure

**Database layer rewritten 2026-11-05** (SQL Server → direct Postgres against the existing
Supabase project; see `04-phase0-schema-port-and-cutover-strategy.md`). Builds the generic
spec's §3 repo structure, a **Postgres-adapted** version of §5's database layer, §7.1 bootstrap,
§8 cross-cutting concerns, and Docker setup, with no feature modules yet beyond `health`. The
generic spec's own §5/§11.4 code is SQL-Server-literal (`mssql`, TVPs, the SQL Server Docker
image) and does not apply as written — this file specifies the Postgres equivalent instead,
keeping the same architectural contract (Controller → Manager → Repository →
`StoredProcRunner`). Directory name: `skolopals-api/`, sibling to `web/` and `db/` inside the
`skolopals/` repo, or a separate repo — **owner decision, default to sibling directory**
`skolopals/api/` unless told otherwise.

## Tasks

1. `pnpm create nestjs-app` (or manual scaffold) with `@nestjs/platform-fastify`; apply generic
   spec §11.2 `tsconfig.json` settings and §11.3 ESLint config, **adapted**: the
   `no-restricted-imports` rule forbids `pg` outside `src/database/` and `*.repository.ts`
   (not `mssql`), and separately forbids `@supabase/supabase-js` outside
   `common/file-storage/` (see task 5).
2. `config/env.schema.ts`: zod schema per generic spec §8.1, **adapted for Postgres** — drop the
   generic table's `DB_SERVER`/`DB_NAME`/SQL-auth variables entirely, replace with:
   - `DATABASE_URL` (required) — Supabase's **direct** connection string (port 5432, session
     mode, not the `6543` pooler — see Phase 0 §1 for why), including the Postgres password.
   - `SUPABASE_JWT_SECRET` (required) — for `JwtAuthGuard` to verify Supabase-issued access
     tokens (Phase 0 §2 / Phase 2). As sensitive as a DB password; never logged.
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (required) — the retained Supabase Storage
     bucket for tutor documents, per Phase 0 §3. Same project as `DATABASE_URL` now, but still a
     distinct credential pair (connection string vs. service-role key) with its own narrow scope
     (file-storage only — see task 5).
   No `SENDGRID_*`, no `TZ_DEFAULT`/luxon requirement — both were only needed under the
   SQL-Server plan (self-hosted email confirmation, manual timezone conversion); Postgres
   handles `AT TIME ZONE 'Africa/Johannesburg'` natively and Supabase Auth owns confirmation
   emails. Write `.env.example` with every variable above.
3. Database layer — **Postgres adaptation of generic spec §5**, same file set, different
   internals: `database.constants.ts`, `.providers.ts` (a `pg.Pool` provider, not `mssql`'s
   connection pool), `-shutdown.service.ts`, `sp-param.ts` (plain JS values — no `sql.TVP`,
   arrays/objects pass straight through as Postgres arrays/`jsonb`), `transaction.context.ts`,
   `unit-of-work.ts`, `sql-error.mapper.ts` (maps Postgres error codes, e.g. `23505` unique
   violation, `23514` check violation — not SQL Server's `THROW`-number scheme),
   `stored-proc.runner.ts`, `database.module.ts`. **One required behavioural change from the
   generic spec, not optional**: per Phase 0 §1, `StoredProcRunner` must open an explicit
   transaction for **every** call, read or write — `BEGIN`, `select set_config('request.jwt.claims', $1, true)`, `set local role authenticated`, run the call, `COMMIT`, release — because RLS
   depends on those two transaction-scoped `SET LOCAL`s being present. Do not let this collapse
   back to the generic spec's "reads don't need `UnitOfWork`" pattern.
4. `main.ts` bootstrap per generic spec §7.1, unchanged. Confirm CORS origin needs to include
   the `web/` app's deployed origin(s) once known (placeholder in `.env.example` for now).
5. `common/`: filter, interceptor, guards, decorators, `PagedResult`, `BusinessRuleException`,
   error codes — generic spec §7.3–§7.5 verbatim; §8.3's guard shape kept, its *contents*
   replaced (`JwtAuthGuard` verifies a Supabase-issued JWT against `SUPABASE_JWT_SECRET`, it
   does not issue or rotate anything — see `06-phase2-auth.md`). One narrow, single-purpose
   wrapper around the one external service this API depends on beyond Postgres/Redis:
   - `common/file-storage/`: `FileStorageService`, wrapping `@supabase/supabase-js` (service-role
     client) to issue signed upload/download URLs against the existing `tutor-documents` bucket
     — per Phase 0 §3. Add `@supabase/supabase-js` as a dependency scoped to this folder only;
     the ESLint rule from task 1 enforces no other module imports it directly. First real
     consumer is the `tutors` module (Phase 3a).
   - No `common/email/` — there is no `EmailService`/SendGrid to build; Supabase Auth owns
     confirmation emails entirely, outside this API.
   `FileStorageService` must be fully mockable in unit tests — no test anywhere in the suite may
   make a real network call to Supabase.
6. `health` module per generic spec §8.5: `/api/health/live`, `/api/health/ready` (Terminus,
   `SELECT 1` through the `pg.Pool` — the only inline SQL in the whole codebase, plus Redis ping
   since caching is enabled per `01-app-definition.md`).
7. Dockerfile + `docker-compose.yml`, **adapted from generic spec §11.4**: services `api` and
   `redis` only — **no local Postgres container**, since the database is the existing Supabase
   project (local/dev connects to it directly via `DATABASE_URL`, or to a Supabase branch if the
   owner wants dev/prod data isolation — a Supabase branch is a reasonable default here and
   avoids needing a separate local Postgres to stay in sync with Supabase's own schema changes).
   No `db-init` service — there is no DDL to apply locally; the schema already exists.
8. No numbers-table or TVP-type DDL to apply (Phase 0 §5 voids both as unnecessary). Nothing to
   do here that Phase 0 didn't already cover.

## Verify

- `pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test` pass with zero
  feature modules (infra unit tests only: `SqlErrorMapper`, `ResponseEnvelopeInterceptor`,
  `AllExceptionsFilter`, guards, `UnitOfWork` commit/rollback — generic spec §10's "Unit: infra"
  row).
- `docker compose up --build` boots; `GET /api/health/live` → 200 immediately; `GET
  /api/health/ready` → 200 once Postgres (the real Supabase connection) and `redis` are
  reachable, 503 before that.
- The Phase 0 §6 spike — a real query through `StoredProcRunner` with an actor's JWT, confirming
  RLS actually restricts the result the way the equivalent PostgREST call would — passes against
  the real Supabase project before this phase is called done. This is the load-bearing proof for
  the whole pivot; nothing past this point should proceed on faith that `set_config`/`SET LOCAL
  ROLE` works as designed.
- `.env.example`'s `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_JWT_SECRET`/
  `DATABASE_URL` are all documented in the README with where to find each one in the Supabase
  dashboard for this project, so a new developer isn't stuck wondering where they come from.
