# CI/CD, Deployment & Rollout Sequencing

This document specifies the step-by-step execution sequence to perform the split safely, along with the required updates to GitHub Actions (`.github/workflows/ci.yml` and `.github/workflows/deploy.yml`) and Vercel project settings.

---

## 1. Execution Sequence (Step-by-Step Rollout)

Execute the migration in 5 atomic, verifiable stages so `pnpm typecheck`, `pnpm lint`, and `pnpm build` can be validated before any CI/CD changes go live:

### Stage 1: Root Workspace & Shared Packages (`packages/shared`, `packages/ui`)
1. Create root `pnpm-workspace.yaml`, root `package.json`, `turbo.json`, and `tsconfig.base.json`.
2. Scaffold `packages/shared/` and `packages/ui/`.
3. Move shared library files into `packages/shared/src/` and shared UI components + `globals.css` into `packages/ui/src/` per [`01-file-and-route-inventory.md`](./01-file-and-route-inventory.md).
4. Update `db/Makefile` (`make types` → `../packages/shared/src/database.types.ts`) and verify `cd db && make types` succeeds.
5. Run `pnpm install` at the repository root and verify `pnpm --filter @skolopals/shared typecheck` and `pnpm --filter @skolopals/ui typecheck` pass.

### Stage 2: Extract `apps/client` (`@skolopals/client`)
1. Use `git mv web apps/client` so Git preserves full file blame/history for the majority of files.
2. Delete `apps/client/package-lock.json` (superseded by root `pnpm-lock.yaml`).
3. Remove `apps/client/src/app/admin/` and `apps/client/src/lib/admin.ts` (moving them into `apps/admin` in Stage 3).
4. Update `apps/client/package.json` (`"name": "@skolopals/client"`, add `"@skolopals/shared": "workspace:*"` and `"@skolopals/ui": "workspace:*"`).
5. Update `apps/client/next.config.ts` (`transpilePackages: ["@skolopals/ui", "@skolopals/shared"]`).
6. Rewrite imports across `apps/client/src/**` from `@/components/{ui,logo,nav-link,coming-soon,app-shell}` and `@/lib/{database.types,api/client,supabase/*,auth,format}` to `@skolopals/ui/*` and `@skolopals/shared/*`.
7. Update `apps/client/src/proxy.ts` and `apps/client/src/app/(auth)/actions.ts` per [`03-app-architecture-and-auth-boundaries.md`](./03-app-architecture-and-auth-boundaries.md).

### Stage 3: Create `apps/admin` (`@skolopals/admin`)
1. Scaffold `apps/admin/` (`package.json` with `"name": "@skolopals/admin"` and `"dev": "next dev -p 3002"`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`).
2. Copy shared static icons (`public/icons/*.svg`) and `public/images/logo.png` into `apps/admin/public/`.
3. Move `src/app/admin/**` and `src/lib/admin.ts` into `apps/admin/src/`.
4. Create `apps/admin/src/app/{layout.tsx,page.tsx,error.tsx,not-found.tsx}`, `apps/admin/src/app/(auth)/{layout.tsx,actions.ts,login/page.tsx,login/login-form.tsx}`, `apps/admin/src/app/auth/confirm/route.ts`, and `apps/admin/src/proxy.ts`.
5. Rewrite imports across `apps/admin/src/**` to use `@skolopals/ui/*` and `@skolopals/shared/*`.
6. Create `apps/admin/scripts/smoke.mjs` to verify `/login` renders cleanly with zero console errors and that `/` redirects to `/login`.

### Stage 4: Workspace-Wide Verification (Local)
1. Run `pnpm install` at the root and verify `pnpm turbo run lint typecheck test build` succeeds across all 5 workspace packages (`skolopals-api`, `@skolopals/shared`, `@skolopals/ui`, `@skolopals/client`, `@skolopals/admin`).
2. Boot `api/` (`PORT=4000`), `apps/client` (`port 3001`), and `apps/admin` (`port 3002`) simultaneously and verify login, role gating, and page rendering on both apps.

### Stage 5: CI/CD & Documentation Updates
1. Update `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`.
2. Update root `README.md` and `docs/DEPLOY.md`.

---

## 2. Continuous Integration (`.github/workflows/ci.yml`)

With `pnpm` workspaces and Turborepo at the root, `ci.yml` simplifies to a unified workspace pipeline (or parallel jobs filtered via `turbo`):

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  ci:
    name: lint, typecheck, test & build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: "24.x"
          cache: pnpm
          cache-dependency-path: pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
          API_URL: ${{ vars.API_URL }}
```

---

## 3. Vercel Projects & Deployment Pipeline (`.github/workflows/deploy.yml`)

### 3.1 Three Vercel Projects

| Workspace | Vercel Project Name | Secret ID | Root Directory (Vercel Dashboard) | Aliases (`dev` / `uat` / `prod`) |
| :--- | :--- | :--- | :--- | :--- |
| `api/` | `skolopals` | `VERCEL_PROJECT_ID_API` | `api` | `skolopals-api-{dev,uat}.vercel.app` / `skolopals-api.vercel.app` |
| `apps/client` | `skolopals-web` | `VERCEL_PROJECT_ID_WEB` | `apps/client` | `skolopals-web-{dev,uat}.vercel.app` / `skolopals-web.vercel.app` |
| `apps/admin` | `skolopals-admin` *(new)* | `VERCEL_PROJECT_ID_ADMIN` *(new)* | `apps/admin` | `skolopals-admin-{dev,uat}.vercel.app` / `skolopals-admin.vercel.app` |

### 3.2 Critical Vercel CLI Monorepo Rule

When a Vercel project's **Root Directory** is configured in the Vercel project settings (e.g. `apps/client` or `apps/admin`) and that app imports workspace packages from `../../packages/*`:

- **Do NOT pass `--cwd apps/client` or `--cwd apps/admin` to `vercel build`.** Passing `--cwd apps/client` when the project's Root Directory is *already* set to `apps/client` either doubles the path (`apps/client/apps/client`) or restricts the build sandbox so it cannot read `pnpm-workspace.yaml` at the repo root.
- Instead, link each directory or run `vercel pull` / `vercel build` / `vercel deploy --prebuilt` from the **repository root** with `VERCEL_PROJECT_ID` set in the step's environment:
  ```bash
  rm -rf .vercel
  vercel pull --yes --environment=preview --token="${{ secrets.VERCEL_TOKEN }}"
  vercel build --token="${{ secrets.VERCEL_TOKEN }}"
  url=$(vercel deploy --prebuilt --token="${{ secrets.VERCEL_TOKEN }}" \
    --env API_URL="${{ vars.API_URL }}")
  ```
  Because Vercel's project settings already record `Root Directory = apps/client` (for `VERCEL_PROJECT_ID_WEB`) and `Root Directory = apps/admin` (for `VERCEL_PROJECT_ID_ADMIN`), running from the repository root allows Vercel CLI to detect the root `pnpm-lock.yaml` and `turbo.json`, install workspace dependencies (`@skolopals/ui`, `@skolopals/shared`), and build the target app cleanly.

### 3.3 Environment Variables & CORS

1. **`VERCEL_PROJECT_ID_ADMIN` (GitHub Repo Secret):** Add the project ID of the new `skolopals-admin` Vercel project.
2. **`skolopals-admin` Vercel Project Env Vars:** Copy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `skolopals-web` to `skolopals-admin` in the Vercel dashboard.
3. **`CORS_ORIGINS` (GitHub Repo Variable):** Append the admin domains to the defensive `CORS_ORIGINS` list:
   ```text
   https://skolopals-web.vercel.app,https://skolopals-web-dev.vercel.app,https://skolopals-web-uat.vercel.app,https://skolopals-admin.vercel.app,https://skolopals-admin-dev.vercel.app,https://skolopals-admin-uat.vercel.app
   ```
4. **Supabase Auth Redirect URLs:** Add `https://skolopals-admin*.vercel.app/auth/confirm` and `http://localhost:3002/auth/confirm` to the Supabase project's **Authentication → URL Configuration → Redirect URLs** allow-list.

### 3.4 Post-Deploy Smoke Tests (`smoke-dev` Job)

Extend the `smoke-dev` job in `.github/workflows/deploy.yml` to run Playwright smoke checks against both deployed frontend applications:

- `node apps/client/scripts/smoke.mjs https://skolopals-web-dev.vercel.app` (checks `/`, `/pricing`, `/timetable`, `/privacy`, `/tutors`)
- `node apps/admin/scripts/smoke.mjs https://skolopals-admin-dev.vercel.app` (checks that `/` redirects to `/login`, `/login` renders `"Admin Sign In"`, and zero browser console errors occur)
