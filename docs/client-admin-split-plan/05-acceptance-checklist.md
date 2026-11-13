# Client & Admin Separation — Acceptance Checklist

## 1. Monorepo & Workspace Foundation

- [x] Root `pnpm-workspace.yaml` includes `apps/*`, `packages/*`, and `api`.
- [x] Root `package.json`, `turbo.json`, and `tsconfig.base.json` exist and orchestrate `build`, `lint`, `typecheck`, `test`, and `dev`.
- [x] Single root `pnpm-lock.yaml` replaces `web/package-lock.json` and `api/pnpm-lock.yaml`; old `web/` directory is completely removed.
- [x] `cd db && make types` writes generated types to `packages/shared/src/database.types.ts`.

## 2. Shared Packages (`@skolopals/shared` & `@skolopals/ui`)

- [x] `@skolopals/shared` exports `./database.types`, `./api`, `./supabase/server`, `./supabase/client`, `./auth`, `./format`, and `./reference`.
- [x] `@skolopals/shared` contains zero app-specific `@/` imports; `pnpm --filter @skolopals/shared typecheck` and `pnpm --filter @skolopals/shared test` pass.
- [x] `@skolopals/ui` exports `./globals.css`, `./ui`, `./logo`, `./nav-link`, `./coming-soon`, and `./app-shell`.
- [x] `packages/ui/src/styles/globals.css` includes `@source "../";` so Tailwind CSS v4 scans all shared UI components.
- [x] `AppShell` accepts `signOutAction` and optional `helpHref` via props (zero imports from `@/app/(auth)/actions`).

## 3. Standalone Client Application (`apps/client`)

- [x] Contains `(public)`, `(auth)` (`/login` and `/signup`), `auth/confirm`, `/parent`, `/learner`, and `/tutor` routes.
- [x] Zero `/admin` routes and zero references to `lib/admin.ts` exist anywhere in `apps/client/`.
- [x] `apps/client/src/proxy.ts` gates `["/parent", "/learner", "/tutor"]` only.
- [x] `clientHomeFor()` never returns `"/admin"`; an admin-only account attempting to sign in on `apps/client` receives a clear message directing them to the Admin Portal rather than a 404 redirect.
- [x] `pnpm --filter @skolopals/client lint`, `typecheck`, and `build` pass cleanly.

## 4. Standalone Admin Application (`apps/admin`)

- [x] Runs on port `3002` in local development (`pnpm --filter @skolopals/admin dev`).
- [x] Contains `/admin/*` routes, `/` → `/admin` redirect, `/login`, and `/auth/confirm`.
- [x] Zero `(public)`, `/signup`, `/parent`, `/learner`, or `/tutor` routes exist in `apps/admin/`.
- [x] `apps/admin/src/proxy.ts` requires authentication for every route except `/login` and `/auth/confirm`.
- [x] `apps/admin` login (`(auth)/actions.ts`) verifies `me.roles.includes("admin")`; non-admin users are immediately signed out with `"Access denied. This portal is restricted to administrators."`
- [x] `apps/admin` `not-found.tsx` and `error.tsx` do not render `<PublicNav />` and link back to `/admin`.
- [x] `pnpm --filter @skolopals/admin lint`, `typecheck`, and `build` pass cleanly.

## 5. CI/CD & Deployment

- [x] `pnpm turbo run lint typecheck test build` passes from the repository root.
- [x] `.github/workflows/ci.yml` uses `pnpm` + Turborepo to lint, typecheck, test, and build `api`, `apps/client`, `apps/admin`, and `packages/*`.
- [ ] `skolopals-admin` Vercel project is created (`Root Directory: apps/admin`), `skolopals-web` Root Directory is updated to `apps/client`, and `VERCEL_PROJECT_ID_ADMIN` secret is configured in GitHub.
- [x] `.github/workflows/deploy.yml` builds, deploys, aliases, and smoke-tests `api`, `apps/client`, and `apps/admin` across `dev`, `uat`, and `production`.
- [x] `README.md` and `docs/DEPLOY.md` are updated to reflect the Turborepo workspace layout and 3-project deployment pipeline.
