# Deploy pipeline

```
push to main ──▶ DEV (auto, aliased preview) ──▶ smoke test ──▶ UAT (approval, alias flip) ──▶ PROD (approval, prod build)
```

GitHub Actions (`.github/workflows/deploy.yml`) owns every deploy via the Vercel CLI. The Vercel
Git integration is deliberately disconnected on both projects — it used to deploy straight to
production on every push, bypassing every gate below.

Two Vercel projects, deployed together at each stage (web/'s server calls api/'s server for
everything except Supabase Auth — see `docs/web-cutover-plan/`):

| Project | Vercel project | Framework | Root directory |
|---|---|---|---|
| `api/` | `skolopals` (`prj_d7V9POqjquXw80EpgQ0TQmM49hjZ`) | NestJS | `api` |
| `web/` | `skolopals-web` (`prj_CmFk21z8Al7H2KMmdz55BDdQBixz`) | Next.js | `web` |

## Aliases

| Stage | api | web |
|---|---|---|
| dev | `skolopals-api-dev.vercel.app` | `skolopals-web-dev.vercel.app` |
| uat | `skolopals-api-uat.vercel.app` | `skolopals-web-uat.vercel.app` |
| production | `skolopals-api.vercel.app` (+ existing `skolopals-omega.vercel.app`) | `skolopals-web.vercel.app` |

**UAT is not a rebuild.** `deploy-uat` only re-aliases the exact dev deployment (byte-identical
artifact) to the uat alias — it doesn't rebuild either app. Production *does* rebuild, because its
build-time env (`API_URL`, `CORS_ORIGINS`) differs from dev/uat.

## Environment values — where they live

Per the pipeline's own design principle, GitHub is meant to be the single source of env truth
(GitHub Environments = approval gates; GitHub environment variables/secrets = config), not Vercel.
**This project deviates from that for one category, on purpose**: `DATABASE_URL`,
`SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, and `REDIS_URL` stay configured
directly on the `skolopals` (api) Vercel project (already set there, correctly, as of 2026-11-08)
rather than being duplicated into GitHub secrets, because:
- They're identical across dev/uat/production right now (one shared Supabase project/Postgres —
  see "Deferred decisions" below), so there's no per-stage value to gate.
- Some are Vercel "sensitive" env vars, which **cannot be read back** via the API/dashboard once
  set — re-extracting them into GitHub would need the user to re-paste every value by hand.

Every deploy (`vercel build`/`vercel deploy`) automatically picks up whatever's configured on the
target Vercel project for that environment (production/preview) — no `--env` flag needed for
these. GitHub owns everything that *does* vary per stage:

| Variable | Scope | dev | production | Used by |
|---|---|---|---|---|
| `API_URL` | GitHub environment variable (`dev`, `production`) | `https://skolopals-api-dev.vercel.app/api/v1` | `https://skolopals-api.vercel.app/api/v1` | `web/`'s server, injected via `vercel deploy --env` |
| `CORS_ORIGINS` | GitHub repo variable (shared) | `https://skolopals-web.vercel.app,https://skolopals-web-dev.vercel.app,https://skolopals-web-uat.vercel.app` | same | `api/`'s server, injected via `vercel deploy --env` — defensive only; web→api traffic is server-to-server, not browser-enforced CORS |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | GitHub repo variables | — | — | CI build only (`ci.yml`); the real deployed values live on the web Vercel project |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_API`, `VERCEL_PROJECT_ID_WEB` | GitHub repo secrets | — | — | every job in `deploy.yml`, to drive the Vercel CLI non-interactively |

## Approving a deploy

Actions → the `Deploy` run → **Review deployments** → tick `uat` (or `production`) → Approve.
`uat` and `production` are GitHub Environments with you as a required reviewer, restricted to the
`main` branch.

## Rollback

- **Fast**: Vercel dashboard → the project → Deployments → pick a previous `READY` production
  deployment → **Promote to Production**. Instant, no rebuild. Do this for both `skolopals` and
  `skolopals-web` if the regression could be in either.
- **Reproducible**: re-run a previous successful `Deploy` workflow run (Actions → that run → *Re-run
  all jobs*), or revert the offending commit on `main` and let the pipeline run fresh.

## Deferred decisions (not solved here, flagged on purpose)

- **One shared Supabase project/Postgres across dev, uat, and production.** Normally each stage
  would get its own database. Revisit once this matters (e.g. before real user data exists in
  production) — splitting later means adding per-stage `DATABASE_URL`/`SUPABASE_*` GitHub secrets
  and removing the Vercel-level ones this doc describes above.
- **`skolopals-omega.vercel.app`** (the api project's original auto-assigned domain) still exists
  alongside the new `skolopals-api.vercel.app` alias. Harmless — both point at the same production
  deployment — but worth removing once nothing references the old one.
- **Smoke coverage is dev-only in CI** (`smoke-dev` job). Nothing currently re-runs it against uat
  or production automatically after their deploys; `web/package.json`'s `npm run smoke -- <url>`
  can be run by hand against any stage.
