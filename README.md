# Skolopals

Skolopals Tutoring Centre — a community education centre in Damonsville, Brits, North West.
Grade R–12, CAPS curriculum, monthly package enrolment.

```
skolopals/
├─ apps/
│  ├─ client/  @skolopals/client — Next.js 16 public site and parent, learner, and tutor portals (port 3001)
│  └─ admin/   @skolopals/admin  — Next.js 16 standalone centre administration portal (port 3002)
├─ packages/
│  ├─ ui/      @skolopals/ui     — Shared design system primitives, AppShell, and Tailwind v4 tokens
│  └─ shared/  @skolopals/shared — Generated DB types, API client, Supabase SSR clients, auth, formatters
├─ api/        skolopals-api     — NestJS 12 Fastify API fronting the database (port 3000 / 4000)
├─ db/         PostgreSQL schema, migrations, seeds and tests. The source of truth
└─ docs/       Business requirements, rebuild specifications, and POPIA policy
```

## Getting started

The database first — the workspace's generated types come from it.

```bash
cd db && make reset      # build the database locally and run all test suites
cd .. && pnpm install    # install all workspace packages
pnpm dev                 # run api, apps/client (3001), and apps/admin (3002) via Turborepo
```

Or run individual apps:

```bash
pnpm dev:api             # NestJS API (http://localhost:3000 or PORT in api/.env)
pnpm dev:client          # Client Web App (http://localhost:3001)
pnpm dev:admin           # Admin Web App (http://localhost:3002)
```

| | |
| --- | --- |
| **Local database** | `postgresql://$(whoami)@localhost:5432/skolopals_dev` |
| **Supabase project** | `clnlvmnfhzyumykbzrjz` (eu-west-2) |
| **Regenerate types** | `cd db && make types` → writes `packages/shared/src/database.types.ts` |

## Documentation

| Document | What it is |
| --- | --- |
| [`docs/BRS-skolopals-2026.md`](docs/BRS-skolopals-2026.md) | Business requirements, traced to the business plan |
| [`docs/SPEC-2026-centre-rebuild.md`](docs/SPEC-2026-centre-rebuild.md) | The implementation specification and delivery phases |
| [`docs/POPIA-policy.md`](docs/POPIA-policy.md) | Privacy notice and compliance annex |
| [`docs/client-admin-split-plan/00-overview.md`](docs/client-admin-split-plan/00-overview.md) | Turborepo client/admin separation architecture |
| [`db/docs/4nf-audit.md`](db/docs/4nf-audit.md) | Why each table is shaped the way it is |
| [`db/docs/ERD.md`](db/docs/ERD.md) | Entity relationship diagrams |

## Deploying

> **Three Vercel projects live in this monorepo:** `api` (`Root Directory: api`),
> `skolopals-web` (`Root Directory: apps/client`), and `skolopals-admin` (`Root Directory: apps/admin`).
> See [`docs/DEPLOY.md`](docs/DEPLOY.md) for full details.

```bash
cd db && make migrate DATABASE_URL="postgresql://...@db.<ref>.supabase.co:5432/postgres"
```

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0–2 | Database: schema, RLS, seeds, 159 tests | **Done** |
| 3 | App: marketplace stripped, ZAR, CAPS, portal shells | **Done** |
| 4 | Enrolment flow, admin queue, timetable builder, registers | **Done** |
| 5 | Assessment, learning plans, termly reports | **Done** |
| 6 | Billing run, payments, statements, messaging | **Done** |
| 7 | Public content | **Done** |
| 8 | Deploy — push schema to the live Supabase project, regenerate types, smoke test | Next |
