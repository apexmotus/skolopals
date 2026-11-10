# Skolopals — web

The public site and the parent, learner, tutor and admin portals for Skolopals Tutoring Centre
(Damonsville, Brits — CAPS curriculum, Grade R–12, monthly package enrolment, billed in ZAR).

**Stack:** Next.js 16 (App Router, Server Components, Server Actions) · Tailwind CSS 4 ·
Supabase Auth (sign-up/sign-in only) · a dedicated NestJS API (`../api`) for everything else.

`web/` is mid-migration from calling Supabase directly to calling `../api` — see
`docs/web-cutover-plan/` at the repo root for exactly which modules have moved and which haven't.
Supabase Auth itself is never migrated; `web/` keeps talking to it directly for login/sign-up.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL/publishable key and API_URL
npm run dev
```

Open http://localhost:3001 (not Next's default 3000 — that's `../api`'s port; see
`.env.example` and `docs/web-cutover-plan/03-sequencing-and-rollout.md`). Run `../api` locally
too (`cd ../api && pnpm install && pnpm run start:dev`) for any page that's already migrated —
check `docs/web-cutover-plan/04-acceptance-checklist.md` for the current list.

## Project layout

| Path | What's there |
| --- | --- |
| `src/app/(public)` | Public site: home, programmes, subjects, tutors directory, pricing, timetable, contact, enrolment, privacy notice |
| `src/app/(auth)` | Login and sign-up (Supabase Auth, not migrated to `../api`) |
| `src/app/parent` | Guardian portal: learners, enrolments, timetable, attendance, progress reports, billing/statements, messages |
| `src/app/learner` | Learner portal |
| `src/app/tutor` | Tutor portal: schedule, class groups, attendance registers, progress reports, pay rates |
| `src/app/admin` | Admin portal: dashboard, enrolment queue, timetable builder, billing run, finance/KPIs, enquiries, resources, reviews |
| `src/lib/api/client.ts` | Server-only fetch wrapper for `../api` — forwards the Supabase session as a Bearer token |
| `src/lib/*.ts` | Server-only data-access modules; each is some mix of `api/client.ts` calls (migrated) and direct Supabase calls (not yet migrated) depending on the module — see the cutover plan |
| `src/proxy.ts` | Refreshes the Supabase session; redirects a signed-out visit to `/parent`, `/learner`, `/tutor` or `/admin` to `/login`. Role checks beyond "signed in" happen in each portal layout and in `../api`'s RLS |

## How it works

- **Roles.** `parent`, `learner`, `tutor`, `admin` (`public.user_roles`). Role-gating is enforced
  twice: `../api`'s `@Roles()` guards (for migrated calls) and Postgres RLS (for every call,
  migrated or not — `../api` connects as the real authenticated Postgres role, same as Supabase's
  PostgREST did before it).
- **Enrolment.** Guardians submit an enrolment application; admins activate it, which creates the
  registration invoice atomically (`public.activate_enrolment`, called via `../api`).
- **Billing.** Monthly invoice runs, late fees, payments and credit notes are admin-only, all
  amounts stored as integer cents. See `../docs/BRS-skolopals-2026.md` for the package/billing
  rules.
- **Auth.** Supabase Auth issues the JWT; `../api` verifies it (`SUPABASE_JWT_SECRET`) and looks
  up roles itself — there's no custom `/auth/*` route in `../api`, and never will be.

## Not production-ready yet

- **POPIA policy sign-off** (`../docs/POPIA-policy.md`) has unresolved `[TO CONFIRM]` fields
  (Information Officer contact details, business registration number, Information Regulator
  registration date) — blocks a safe public go-live independent of anything else.
- **The `../api` cutover is partial.** Several `src/lib/*.ts` modules still call Supabase
  directly; don't assume every page already goes through `../api`.
