# Client & Admin Separation Specification — Overview

This specification defines the architecture, file-by-file migration inventory, shared package boundaries, authentication isolation, and CI/CD rollout plan for splitting the monolithic `web/` Next.js application into two standalone web applications managed by **Turborepo** and **pnpm workspaces**:

- **`apps/client`** — The public-facing website (`(public)`), parent portal (`/parent`), learner portal (`/learner`), and tutor workspace (`/tutor`).
- **`apps/admin`** — The standalone centre administration web application (`/admin` and `/login`).

---

## 1. Architectural Goals

1. **Independent Deployment & Runtime Isolation**: `apps/client` and `apps/admin` build, deploy, and scale as two separate Next.js 16 applications (each backed by its own Vercel project, domain alias, and cookie jar). A change to admin-only workflows (`billing`, `expenses`, `enrolments`, `reports`) no longer forces a rebuild or redeploy of the public/client portal, and vice versa.
2. **Strict Security & Role Boundary Separation**:
   - `apps/client` never ships admin routes, server actions, or admin KPI/finance queries (`lib/admin.ts`).
   - `apps/admin` exposes no public marketing pages, no self-registration (`/signup`), and rejects any authenticated user who does not hold the `admin` role at login and middleware/layout boundaries.
3. **Zero-Duplication Code Sharing via Focused Workspace Packages**:
   - **`@skolopals/ui`**: Shared design system primitives (`Button`, `Card`, `DataTable`, `Badge`, `Field`, `Input`, `Select`, `StatusState`, `EmptyState`), `AppShell`, `Logo`, `NavLink`, `ComingSoon`, and Tailwind v4 design tokens (`globals.css`).
   - **`@skolopals/shared`**: Generated database types (`database.types.ts`), server-only NestJS API client (`api/client.ts`), Supabase SSR/browser client factories (`supabase/server.ts`, `supabase/client.ts`), session/role primitives (`auth.ts`), shared reference-data queries (`getPhases`, `getGrades`, `getSubjects`, `getLanguages`, `getRooms`), and formatting utilities (`format.ts`).
4. **Unified Package Management & Build Orchestration**:
   - Standardize the repository on **`pnpm` (v10)** workspaces at the root (aligning with `api/`, which already uses `pnpm` 10) and orchestrate `lint`, `typecheck`, `test`, and `build` across `apps/client`, `apps/admin`, `packages/*`, and `api/` via **Turborepo** (`turbo.json`).

---

## 2. Target Monorepo Topology

`api/` and `db/` remain at their existing root paths so no database scripts, NestJS paths, or existing developer workflows break. `web/` is replaced by `apps/client`, `apps/admin`, `packages/ui`, and `packages/shared`:

```text
skolopals/
├── package.json                  # Root workspace manifest (private, packageManager: pnpm@10.x, turbo scripts)
├── pnpm-workspace.yaml           # Workspace globs: ["apps/*", "packages/*", "api"]
├── pnpm-lock.yaml                # Single unified lockfile for apps/*, packages/*, and api/
├── turbo.json                    # Turborepo task pipeline (build, dev, lint, typecheck, test)
├── tsconfig.base.json            # Shared strict TypeScript compiler options for frontend apps & packages
├── apps/
│   ├── client/                   # @skolopals/client — Next.js 16 (port 3001)
│   │   ├── public/               # Shared icons + logo + public marketing photography
│   │   ├── scripts/smoke.mjs     # Client post-deploy Playwright smoke check
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/       # /login and /signup (parent self-registration)
│   │       │   ├── (public)/     # /, /subjects, /tutors, /timetable, /programmes, /pricing, /contact, /enrol, /privacy
│   │       │   ├── auth/confirm/ # PKCE email verification callback
│   │       │   ├── parent/       # Parent portal
│   │       │   ├── learner/      # Learner portal
│   │       │   └── tutor/        # Tutor workspace
│   │       ├── components/       # Client-only components (public-nav, tutor-card, messages/*)
│   │       ├── lib/              # Client-only data modules (parent, tutor, assessment, messages, centre, consent, public queries)
│   │       └── proxy.ts          # Session refresh + auth gate for ["/parent", "/learner", "/tutor"]
│   └── admin/                    # @skolopals/admin — Next.js 16 (port 3002)
│       ├── public/               # Shared icons + logo only (no marketing photos)
│       ├── scripts/smoke.mjs     # Admin post-deploy Playwright smoke check (/login render check)
│       └── src/
│           ├── app/
│           │   ├── page.tsx      # Redirects "/" -> "/admin"
│           │   ├── (auth)/       # /login only (no /signup; rejects non-admin accounts)
│           │   ├── auth/confirm/ # PKCE callback for admin password/invite links
│           │   └── admin/        # Dashboard, enrolments, learners, tutors, timetable, billing, expenses, enquiries, notifications, reports
│           ├── lib/              # Admin-only data modules (admin.ts)
│           └── proxy.ts          # Session refresh + auth gate for all /admin/* routes
├── packages/
│   ├── ui/                       # @skolopals/ui — Design system components, AppShell, globals.css
│   └── shared/                   # @skolopals/shared — database.types, api client, supabase clients, auth core, formatters, reference queries
├── api/                          # skolopals-api — NestJS 12 Fastify API (port 3000 / 4000 locally)
├── db/                           # PostgreSQL schema, migrations, seeds, test suites, type generator
└── docs/                         # Project specifications and plans
```

---

## 3. What Does NOT Change

- **Database (`db/`) and NestJS API (`api/`):** Zero schema changes and zero NestJS endpoint changes are required. The only touchpoint in `db/` is updating `db/Makefile`'s `make types` target output path from `../web/src/lib/database.types.ts` to `../packages/shared/src/database.types.ts`.
- **Server-Only Data Access Model:** Exactly as documented in [`docs/web-cutover-plan/00-overview.md`](../web-cutover-plan/00-overview.md), all data reads and writes execute server-side in Next.js Server Components and `"use server"` Server Actions. Neither `apps/client` nor `apps/admin` makes browser-side API calls.
- **Compatibility with In-Flight `web-cutover-plan`:** Because `@skolopals/shared` exports both the new `api` client (`@skolopals/shared/api`) and the existing Supabase server client (`@skolopals/shared/supabase/server`) + `database.types.ts`, this split can be executed seamlessly either **before**, **during**, or **after** the remaining module slices in `docs/web-cutover-plan/`.

---

## 4. Local Development Port Allocation

To run the full stack locally without port collisions:

| Service | Workspace Name | Default Local Port | Environment Variable |
| :--- | :--- | :--- | :--- |
| **NestJS API** (`api/`) | `skolopals-api` | `3000` (or `4000`) | `PORT` in `api/.env` |
| **Client Web App** (`apps/client/`) | `@skolopals/client` | `3001` | `next dev -p 3001` |
| **Admin Web App** (`apps/admin/`) | `@skolopals/admin` | `3002` | `next dev -p 3002` |

---

## 5. Files in This Specification

- [`00-overview.md`](./00-overview.md) — Architectural goals, target monorepo structure, and scope boundaries (this document).
- [`01-file-and-route-inventory.md`](./01-file-and-route-inventory.md) — Exhaustive, grep-verified mapping of every file in `web/` to `apps/client`, `apps/admin`, `packages/ui`, or `packages/shared`.
- [`02-turborepo-and-shared-packages.md`](./02-turborepo-and-shared-packages.md) — Root workspace config (`pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`) and internal contracts for `@skolopals/ui` and `@skolopals/shared`.
- [`03-app-architecture-and-auth-boundaries.md`](./03-app-architecture-and-auth-boundaries.md) — Routing, middleware (`proxy.ts`), role-based redirect rules (`homeFor` vs `requireAdmin`), and Next.js 16 configuration for `apps/client` and `apps/admin`.
- [`04-ci-cd-deployment-and-sequencing.md`](./04-ci-cd-deployment-and-sequencing.md) — Phased migration sequence, GitHub Actions (`ci.yml` and `deploy.yml`), and Vercel multi-project configuration.
- [`05-acceptance-checklist.md`](./05-acceptance-checklist.md) — Verification checklist to sign off on the completed separation.
