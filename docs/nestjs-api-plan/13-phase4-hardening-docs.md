# Phase 4 — Hardening & Docs

Applies generic spec Phase 4 verbatim, with project-specific content for the parts that are
templates in the generic spec (`docs/sp-contract.md`, README, k6 script).

## Tasks

1. **Coverage thresholds**: run `pnpm test:cov` across all 19 modules; Managers ≥ 85% lines,
   overall ≥ 75% per generic spec §10. RLS is kept live as the real authorization backstop
   (Phase 0 §1-§2), which is a real risk reduction from the SQL-Server plan's "Manager-layer-only"
   model — but the `set_config`/`SET LOCAL ROLE` connection pattern itself is new and unproven
   outside the Phase 1 spike, so treat the modules that exercise it hardest (`people`,
   `enrolment`, `timetable`, `billing`, `communication` — the ones with real row-level
   visibility differences between actors) as deserving e2e coverage proving RLS actually
   applies through this API, not just Manager-level mocked tests that assume it does.
2. **`docs/sp-contract.md`**: generate from `02-sp-catalogue.md` — every function name
   (resolved to its real Postgres name per the Phase 0 §6 audit, not the logical `usp_` label),
   parameters, result shape, and the semantic error-code table from generic spec §5.6
   (`VALIDATION_FAILED`/`FORBIDDEN`/`NOT_FOUND`/`CONFLICT`/`BUSINESS_RULE_VIOLATION` — no SQL
   Server THROW numbers), so a future DBA or integrator has one human-readable contract document
   without reading `02-sp-catalogue.md`'s planning framing. This is the generic spec's required
   deliverable; `02-sp-catalogue.md` is this plan's working document, `docs/sp-contract.md` is
   the shipped artifact — keep them in sync but don't conflate them.
3. **README** (generic spec §11.5, plus project-specific sections):
   - Prerequisites, env setup, local run, test run — standard.
   - Project structure summary, layer rules, SP error convention, pool sizing — standard.
   - **Added for this project**: a short "API in front of the existing Supabase project"
     section pointing at `docs/nestjs-api-plan/` for anyone who finds a behavioural difference
     from the old direct-Supabase-client setup and wants to know whether it's intentional (most
     differences should be explainable by pointing at the relevant file in this plan).
   - **Added for this project**: the direct-Postgres connection setup (`DATABASE_URL`, the
     `set_config`/`SET LOCAL ROLE` pattern from Phase 0 §1), the Supabase Auth JWT verification
     setup (`SUPABASE_JWT_SECRET`, Phase 0 §2), and the Supabase Storage dependency for tutor
     documents (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, Phase 0 §3 — note that local dev
     needs real credentials for both since there's no local emulator for either), since none of
     this is in the generic spec's template README at all.
4. **k6 script** (`test/load/smoke.js`, `docs/load-test.md` per generic spec §12.9): log in as
   a seeded parent, then hammer `GET /class-groups` (a representative cacheable public read)
   and `POST /billing-accounts/:id/payments`-equivalent-weight write — actually use
   `POST /class-sessions/:id/attendance` as the write target instead, since billing writes are
   admin-rare in production and attendance-marking is the actual high-frequency write path
   during a real school day. Default thresholds `p(95) < 300ms`, error rate `< 1%`, tunable by
   the owner once real load is observed.
5. Final lint pass with the `no-restricted-imports` rule from generic spec §11.3 actually
   enabled (not just planned) — confirm no controller imports a `*.repository`, no file outside
   `database/`/`*.repository.ts` imports `pg`, and no file outside `common/file-storage/`
   imports `@supabase/supabase-js`.

## Verify (generic spec §0.3, run on a clean clone)

```
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
docker compose up --build     # API boots, GET /api/health/ready returns 200
```

Plus `15-acceptance-checklist.md` fully ticked. Phase 4 is the last phase before Phase 5 touches
real data — do not start Phase 5 until this phase's verification is green on a clean clone, not
just on a developer's already-warm machine.
