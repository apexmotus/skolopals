# Skolopals

Skolopals Tutoring Centre — a community education centre in Damonsville, Brits, North West.
Grade R–12, CAPS curriculum, monthly package enrolment.

```
skolopals/
├─ web/    Next.js 16 app — public site and the parent, learner, tutor and admin portals
├─ db/     PostgreSQL schema, migrations, seeds and tests. The source of truth
└─ docs/   Business requirements, the rebuild specification and the POPIA policy
```

## Getting started

The database first — the app's generated types come from it.

```bash
cd db  && make reset      # build the database locally and run all test suites
cd ../web && npm install && npm run dev
```

Open http://localhost:3000.

| | |
| --- | --- |
| **Local database** | `postgresql://$(whoami)@localhost:5432/skolopals_dev` |
| **Supabase project** | `dhmjzshlznhqohvkdcpz` (eu-west-2) |
| **Regenerate types** | `cd db && make types` → writes `web/src/lib/database.types.ts` |

## Documentation

| Document | What it is |
| --- | --- |
| [`docs/BRS-skolopals-2026.md`](docs/BRS-skolopals-2026.md) | Business requirements, traced to the business plan |
| [`docs/SPEC-2026-centre-rebuild.md`](docs/SPEC-2026-centre-rebuild.md) | The implementation specification and delivery phases |
| [`docs/POPIA-policy.md`](docs/POPIA-policy.md) | Privacy notice and compliance annex |
| [`db/docs/4nf-audit.md`](db/docs/4nf-audit.md) | Why each table is shaped the way it is |
| [`db/docs/ERD.md`](db/docs/ERD.md) | Entity relationship diagrams |

## Deploying

> **The app lives in `web/`, not at the repo root.** Vercel's **Root Directory**
> must be set to `web` or builds will fail with "no package.json found".
> See `docs/SPEC-2026-centre-rebuild.md` §5.

```bash
cd db && make migrate DATABASE_URL="postgresql://...@db.<ref>.supabase.co:5432/postgres"
```

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0–2 | Database: schema, RLS, seeds, 159 tests | **Done** |
| 3 | App: marketplace stripped, ZAR, CAPS, portal shells | **Done** |
| 4 | Enrolment flow, admin queue, timetable builder, registers | Next |
| 5 | Assessment, learning plans, termly reports | |
| 6 | Billing run, payments, statements, messaging | |
| 7–8 | Public content, deploy | |
