# Skolopals API

NestJS API in front of the existing Skolopals Supabase Postgres database (`../db/`). The
database and Supabase Auth stay exactly as they are; this API replaces `web/`'s direct
`@supabase/supabase-js` calls with a layered, auditable backend. Full rationale and the phased
build plan: `../docs/nestjs-api-plan/` (start at `00-overview.md`).

## Prerequisites

- Node.js 24, pnpm 10
- A local Postgres built from `../db/` (`cd ../db && make reset`) for local dev/testing, **or**
  a Supabase project/branch for anything beyond infra-only work
- Redis (for caching — `docker compose up redis`, or any local Redis)

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | Supabase dashboard → Project Settings → Database → Connection string → URI, **Session mode** (port `5432`, never the `6543` pooler — see `../docs/nestjs-api-plan/04-phase0-schema-port-and-cutover-strategy.md` §1). For local dev against `db/`'s local Postgres, use `postgresql://<your-unix-user>@localhost:5432/skolopals_dev`. |
| `SUPABASE_JWT_SECRET` | Supabase dashboard → Project Settings → API → JWT Settings → JWT Secret. Treat like a database password; never log it. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API. Used only by `common/file-storage/` (signed URLs for the `tutor-documents` bucket) and one-off admin scripts — never for per-request data access. |
| `REDIS_URL` | Your Redis instance; `redis://localhost:6379` for the bundled `docker-compose.yml` service. |
| everything else | Has a sensible default — see `.env.example` and `src/config/env.schema.ts`. |

## Run locally

```bash
pnpm install
pnpm run start:dev
```

`GET /api/health/live` should return 200 immediately; `GET /api/health/ready` returns 200 once
Postgres and Redis are both reachable.

## Run tests

```bash
pnpm test          # unit tests (no network, no DB)
pnpm test:cov       # with coverage
pnpm test:e2e       # e2e (Phase 2+)
pnpm typecheck
pnpm lint
```

### The RLS spike

```bash
cd ../db && make reset   # once, to build the local schema + RLS policies
DATABASE_URL=postgresql://$(whoami)@localhost:5432/skolopals_dev pnpm run verify:rls
```

Proves, against the real schema and the *actual* `applyRlsContext` code (`src/database/rls-context.ts`),
that the `set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE` pattern this API's database
layer issues on every call makes row-level security behave exactly like it does for PostgREST
today — an anonymous actor gets nothing back, and two different authenticated actors each see
only their own row. This is the load-bearing proof for the whole "direct Postgres connection
instead of PostgREST" pivot (see `../docs/nestjs-api-plan/04-phase0-schema-port-and-cutover-strategy.md`).
Everything the script inserts lives inside one rolled-back transaction; it never touches real data.

### Module-specific live smoke scripts

Same one-rolled-back-transaction discipline as the RLS spike above, but driving a real
`Manager`/`Repository` pair (not reimplemented SQL) for the modules where a mocked unit test
can't catch a real schema mismatch or a genuine RLS gap — and has caught several real bugs this
way (see `scripts/*.ts`'s own doc comments and `02-sp-catalogue.md`/the project's own memory for
specifics): `pnpm run verify:billing`, `pnpm run verify:phase3e` (consent/enquiries/communication/
resources/reviews), `pnpm run verify:finance`. Each needs `DATABASE_URL` set the same way as above.

## Creating the first admin account

There is no admin-grant API endpoint by design (`../docs/nestjs-api-plan/06-phase2-auth.md`
"First admin account") — an admin account is never self-service. After the person has a normal
Supabase Auth account (so `auth.users`/`public.profiles` already have their row), grant the role
directly:

```sql
insert into public.user_roles (user_id, role) values ('<their auth.users.id>', 'admin');
```

Run it against the target Supabase project's SQL console, or via `psql "$DATABASE_URL"` locally.
No seed script or bootstrap endpoint exists for this, and none is planned — it's a rare,
one-person, one-time action, not a workflow worth automating.

## Load test

`test/load/smoke.js` ([k6](https://k6.io), a standalone binary — not run by `pnpm test`). See
`docs/load-test.md` for the environment variables it needs and what it actually exercises.

## Docker

```bash
docker compose up --build
```

Builds and runs `api` (reading `.env` for its Supabase/Redis connection details) and `redis`.
There is **no local Postgres container** — the database is the existing Supabase project (or a
branch of it); see `docs/nestjs-api-plan/05-phase1-scaffold-infrastructure.md` task 7.

## Architecture

Strict layering, enforced by code review and an ESLint `no-restricted-imports` rule:

```
Controller → Manager → Repository → StoredProcRunner → Postgres
```

- **Controller**: routes, DTOs, `@Roles`/`@Public`, Swagger — no business logic, no DB access.
- **Manager**: business rules, orchestration, caching, `UnitOfWork.run()` for multi-call writes.
  Throws `NotFoundException`/`ConflictException`/`ForbiddenException`/`BusinessRuleException`.
  No HTTP or SQL knowledge.
- **Repository**: one method per Postgres function, via `StoredProcRunner`. No business logic.
- **`StoredProcRunner`** (`src/database/`): the only thing that calls Postgres. Every call — read
  or write — runs inside its own transaction with `set_config('request.jwt.claims', ...)` +
  `SET LOCAL ROLE` as the first statements, so RLS applies exactly as it does through PostgREST.
  Calls Postgres functions with named-parameter syntax (`fn(p_foo := $1, ...)`), never positional.

No ORM. No inline SQL anywhere except `GET /api/health/ready`'s `SELECT 1`. Rows (DB column
names, `rows/*.row.ts`) never leave the Manager; DTOs (camelCase, `dto/*.dto.ts`) never enter the
Repository.

### Adding a module

Follow `nestjs-api-implementation-spec.md` (repo root) §9, module by module, per
`docs/nestjs-api-plan/01-app-definition.md` §1.4's module list and `03-endpoints-and-business-rules.md`
for that module's endpoints/rules: Rows → Repository → DTOs → Mapper → Manager → Controller →
Module → tests → register in `AppModule`.

### Error handling

Full contract (every real Postgres function this API calls, its parameters/return shape, plus
this table) lives in `docs/sp-contract.md`. Quick reference — every Postgres error is mapped by
`src/database/sql-error.mapper.ts`:

| SQLSTATE | Meaning (this project's convention) | HTTP | Code |
|---|---|---|---|
| `23505`/`23503`/`23P01` | unique/FK/exclusion violation | 409 | `CONFLICT` |
| `23514` | `check_violation` — a business-rule trigger (capacity, competency, consent) | 422 | `BUSINESS_RULE_VIOLATION` |
| `P0001` | plain `raise exception` — default; a Manager that knows the specific SP's contract may re-throw more precisely | 422 | `BUSINESS_RULE_VIOLATION` |
| `23502`/`22P02` | not-null / invalid input | 400 | `VALIDATION_FAILED` |
| `40001`/`40P01` | serialization/deadlock — retried automatically, then | 503 | `SERVICE_UNAVAILABLE` |
| anything else | never leaks the SQL message | 500 | `INTERNAL_ERROR` |

Every error response has the shape: `{ status, code, title, detail, traceId, path, timestamp, errors? }`.

### Pool sizing

`DB_POOL_MAX` (default 20) bounds direct Postgres connections against Supabase's own connection
limit for this project (Supabase dashboard). The transaction pooler (port `6543`) is deliberately
not used — see the RLS spike section above for why session-scoped `SET LOCAL` matters here.
