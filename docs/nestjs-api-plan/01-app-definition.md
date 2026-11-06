# Section 1.1–1.4 — App Definition

Fills generic spec §1.1 (`Identity`), §1.2 (`Options`), §1.3 (`Authentication and
authorisation`), §1.4 (`Modules`). Derived from `db/migrations/*.sql` and `web/src/`, per
`00-overview.md`.

## 1.1 Identity

| Field | Value |
|---|---|
| App name | Skolopals API |
| One-line purpose | Backend API for Skolopals, a physical CAPS tutoring centre (Damonsville, Brits) — enrolment, timetabling, attendance, assessment, billing, communication and admin reporting for parents, learners, tutors and administrators. |
| API base path | `/api` (URI versioning: `/api/v1/...`) |
| Package name | `skolopals-api` |
| Database engine | **PostgreSQL, via the existing Supabase project (decided 2026-11-05, superseding an earlier SQL Server decision)** — direct `pg` connection, not PostgREST; see `04-phase0-schema-port-and-cutover-strategy.md`. |
| Expected load | **Confirmed by owner (2026-11-05)**: single-centre traffic, low hundreds of accounts, low tens of concurrent users at peak (drop-off/pickup windows, 15th-of-month billing run, term-start enrolment rush). `DB_POOL_MAX=20`/`DB_POOL_MIN=2` (generic spec §5.9 defaults) is sized generously for this against Supabase's own connection limit; a single API instance is expected to be sufficient. |

## 1.2 Options

| Option | Value | Why |
|---|---|---|
| Generate local SP stubs | **no** | The Postgres database already exists (the current Supabase project) with its functions/views already in place; there is no schema to stub out. Local dev connects to a Supabase branch/dev project (or the same project, carefully) rather than booting a fresh container from DDL stubs. |
| Redis caching | **yes** | Public reference data (grades, subjects, packages, timetable) and the tutor directory are read far more than written. See `03-endpoints-and-business-rules.md` for the per-module cache list. |
| Background jobs (BullMQ) | **no** | `run_monthly_invoices` and `apply_late_fees` are admin-button actions today (`web/src/app/admin/billing/actions.ts`), not cron jobs. Kept as synchronous endpoints; scheduling is a documented future option in `10-phase3d-billing.md`, not built now. |
| File uploads | **yes — Supabase Storage, same project as the DB (decided 2026-11-05)** | Tutor vetting documents (ID, qualification certs, police clearance, CV) stay on the existing private Supabase Storage bucket `tutor-documents` (admin-read/write only, 50 MB limit, `image/jpeg`, `image/png`, `application/pdf`); the API proxies to it via a signed-URL `FileStorageService`. See `04-phase0-schema-port-and-cutover-strategy.md` §3. |
| Multi-tenant | **no** | One centre. No tenant column or resolution needed anywhere. |

## 1.3 Authentication and authorisation

**Superseded 2026-11-05: Supabase Auth is kept, not replaced.** An earlier version of this
section had the API fully replace Supabase Auth (self-hosted argon2id + JWT + refresh tokens +
SendGrid confirmation), because that version also replaced the database with SQL Server and
there would have been no managed auth service left. That's reversed — the database stays
Supabase Postgres, so Supabase Auth stays too.

| Field | Value |
|---|---|
| Auth model | **Supabase Auth, unchanged.** Supabase issues and refreshes the JWT exactly as it does for `web/` today (`@supabase/supabase-js`, client-managed session, refresh handled by the Supabase SDK). The NestJS API does not issue tokens; it only **verifies** the JWT Supabase already issued, via `SUPABASE_JWT_SECRET` (`JwtAuthGuard`, generic spec §8.3's guard shape, Supabase-literal verification logic). No `Users`/`RefreshTokens` tables, no token rotation code, in this API at all. |
| Login identifier | email (Supabase Auth's own, unchanged) |
| Roles | `parent`, `learner`, `tutor`, `admin` — **a person may hold more than one role simultaneously** (e.g. a parent who is also a tutor). Still a `public.user_roles` join table (`user_id`, `role`), exactly as it exists today — no port, no new table. Confirm during Phase 1 whether the existing Postgres auth hook already injects `roles` into the JWT's claims or whether the Manager must look them up via `user_roles` on each request (either is fine; just establish which once, in Phase 1, rather than guessing per module). |
| Public endpoints | Every endpoint marked `@Public()` in `03-endpoints-and-business-rules.md` (public site: timetable, tutor directory, subjects/grades/packages/programmes, `POST /enquiries`). This API has **no** `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/confirm-email`, etc. — `web/` calls Supabase Auth directly for all of those, unchanged from today. `GET /auth/me` may optionally exist as a thin convenience read; see `06-phase2-auth.md`. |
| Password hashing | Not this API's concern — Supabase Auth already does this, unchanged. |

### Role → area mapping (for reference; enforced per-endpoint in `03-...md`)

| Role | Portal | Can never see |
|---|---|---|
| `admin` | `/admin/*` | — (sees everything) |
| `tutor` | `/tutor/*` | Billing, consents, medical notes, emergency contacts, authorised collectors (POPIA — pastoral/billing data is explicitly admin+guardian only, tutors excluded) |
| `parent` (guardian) | `/parent/*` | Other families' data; other tutors' pay rates; vetting documents |
| `learner` | `/learner/*` (optional login — most children have no account at all; `profile_id` on `learners` is nullable) | Billing, consents, medical notes, other learners' data |

## 1.4 Modules

One NestJS module per row, folder name kebab-case plural, grouped by the delivery-phase slice
that builds it (see `00-overview.md`). `auth` and `health` always exist (generic spec §1.4,
built in Phase 2 and Phase 1 respectively — not listed again below).

| Module | Folder | Purpose | Built in |
|---|---|---|---|
| reference | `reference/` | CAPS phases, grades, subjects, subject offerings, languages, achievement levels, terms, operating hours, rooms — slow-moving lookups, admin-maintained, public-read | Phase 3a |
| people | `people/` | Profiles, guardians, learners, learner↔guardian links, safeguarding (emergency contacts, authorised collectors, medical notes) | Phase 3a |
| tutors | `tutors/` | Tutor records, competencies (subject×grade×medium), spoken languages, qualifications, vetting documents, references, pay rates | Phase 3a |
| packages | `packages/` | Packages, temporal pricing, billing settings | Phase 3b |
| enrolment | `enrolment/` | Enrolment submission, approval/activation, subject selection | Phase 3b |
| timetable | `timetable/` | Class groups, grades-per-class, weekly schedule, materialised sessions, class placement (`class_enrolments`) | Phase 3b |
| attendance | `attendance/` | Attendance marking, sign-in/sign-out with authorised-collector verification | Phase 3b |
| programmes | `programmes/` | Holiday/Saturday/exam-prep programmes, programme sessions, bookings, programme attendance | Phase 3b |
| assessment | `assessment/` | Assessment types/domains, assessments, per-domain scores, individual learning plans and goals | Phase 3c |
| progress-reports | `progress-reports/` | Termly progress reports, per-subject detail, parent acknowledgement | Phase 3c |
| billing | `billing/` | Billing accounts, invoices, invoice lines, payments, allocations, credit notes, the monthly invoice run, late fees | Phase 3d |
| communication | `communication/` | Message threads, participants, messages, read state, announcements/notifications | Phase 3e |
| enquiries | `enquiries/` | Public contact-form enquiries and admin triage/conversion | Phase 3e |
| resources | `resources/` | Shared learning resources and their audience targeting | Phase 3e |
| reviews | `reviews/` | Guardian tutor reviews, moderation, derived rating summary | Phase 3e |
| consent | `consent/` | POPIA consent types, consent records, retention policy and purge log | Phase 3e |
| finance | `finance/` | Expense categories, expenses, and every financial/academic/business KPI view | Phase 3f |

17 feature modules + `auth` + `health` = 19 modules total.
