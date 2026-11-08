# Call-Site Inventory

Every `.rpc()` and `.from()` call in `web/src/` as of 2026-11-08, confirmed by grep (not
estimated), grouped by file and mapped to the API module that replaces it. `Array.from(...)`
(plain JS, not Supabase) was excluded by matching only `.from("<table>")`. Two files that showed
up in an earlier looser grep — `(public)/tutors/loading.tsx` (a `Array.from` loading skeleton)
and `lib/centre.ts`/`lib/consent.ts` (plain constants, no Supabase calls at all) — are **not**
real call sites and are dropped from this inventory.

Where a table/view maps unambiguously to one endpoint, it's named. Where the API has several
candidate endpoints for the same underlying data (e.g. a view feeding more than one report), this
says so explicitly rather than guessing — confirm the exact one against that module's
`*.controller.ts` when migrating that file, per `03-sequencing-and-rollout.md`'s per-slice
verification step.

## Writes — `.rpc()` (15 sites, 8 files)

| File | Function(s) called | Target endpoint |
|---|---|---|
| `src/app/(public)/enrol/actions.ts` | `submit_enrolment` | `POST /enrolments` |
| `src/app/admin/enrolments/actions.ts` | `activate_enrolment` | `POST /enrolments/:id/activate` |
| `src/app/admin/tutors/actions.ts` | `create_tutor`, `set_tutor_competency`, `set_tutor_pay_rate` | `POST /tutors`, `PUT /tutors/:id/competencies`, `PUT /tutors/:id/pay-rates` |
| `src/app/admin/billing/actions.ts` | `run_monthly_invoices`, `apply_late_fees`, `record_payment` | `POST /billing/run-monthly-invoices`, `POST /billing/apply-late-fees`, `POST /billing-accounts/:id/payments` |
| `src/app/admin/timetable/actions.ts` | `generate_class_sessions` (2 call sites) | `POST /class-groups/:id/generate-sessions` |
| `src/app/tutor/assessments/actions.ts` | `record_assessment`, `create_learning_plan` | `POST /learners/:id/assessments`, `POST /learners/:id/learning-plans` |
| `src/app/tutor/reports/actions.ts` | `save_progress_report` | `PUT /learners/:id/progress-reports/:termId` |
| `src/components/messages/actions.ts` | `start_thread`, `mark_thread_read` | `POST /threads`, `POST /threads/:id/read` |

Every one of these functions is a real Postgres function the API's own `*.repository.ts` already
calls with the exact same parameters (confirmed during the API build, see
`api/docs/sp-contract.md`) — this is a pure transport swap, not a logic change.

## Reads — `.from()` (62 unique tables/views, ~29 files)

### The auth/session slice (do this first — see `00-overview.md`)

| File | Table(s) | Target |
|---|---|---|
| `src/lib/auth.ts` (`getSession`) | `profiles`, `user_roles` | `GET /people/me` — confirm response includes roles; `requireUser`/`requireRole`/`homeFor` depend on this |
| `src/app/(auth)/actions.ts` (`login`) | `user_roles` | same `GET /people/me` call, right after `signInWithPassword` succeeds |
| `src/lib/auth.ts` (`getMyTutor`, `getMyLearners`) | `tutors`, `learner_guardians` | `GET /tutors/me`, `GET /learners?guardianId=me`-equivalent (confirm `learners.controller.ts`'s list endpoint's actor-scoping) |

### Reference data (lowest risk — all public/read-only, migrate early to de-risk the API-client pattern)

| File | Table(s) | Target module |
|---|---|---|
| `src/lib/queries.ts` | `school_phases`, `grades`, `subjects`, `languages`, `subject_offerings`, `packages`, `package_prices`, `centre_operating_hours`, `v_public_timetable`, `programmes` | `reference` (`/reference/*`), `packages`, `timetable` (`GET /timetable/public`), `programmes` |
| `src/app/(public)/privacy/page.tsx`, `src/app/(public)/enrol/page.tsx` | `consent_types`, `data_retention_policies` | `reference` (`/reference/consent-types`); confirm `data_retention_policies`' source — may be `consent` module |
| `src/app/admin/timetable/page.tsx`, `.../actions.ts` | `terms`, `rooms`, `class_groups`, `class_group_grades`, `class_schedules` | `reference` (`/reference/terms`, `/reference/rooms`), `timetable` (`/class-groups*`) |

### Tutors directory + profile

| File | Table(s) | Target module |
|---|---|---|
| `src/lib/queries.ts` (public directory) | `tutors`, `tutor_competencies`, `tutor_spoken_languages`, `tutor_rating_summary`, `tutor_qualifications`, `reviews` | `tutors` (`GET /tutors`, `GET /tutors/:slug`), `reviews` (`GET /tutors/:id/reviews`) — confirm whether `tutor_rating_summary` is folded into the tutors public-profile response or needs the reviews endpoint separately |
| `src/lib/tutor.ts` (own workspace) | `tutors`, `class_groups`, `class_sessions`, `class_enrolments`, `v_tutor_session_load`, `tutor_pay_rates` | `tutors` (`GET /tutors/me`, `/pay-rates`), `timetable` (`class-groups`/`class-sessions`/`enrolments`), `finance` (`kpis/tutor-session-load`) |
| `src/app/admin/tutors/actions.ts`, `.../[id]/page.tsx` | `tutors`, `tutor_competencies`, `tutor_spoken_languages` | `tutors` admin endpoints |
| `src/app/tutor/register/page.tsx` | `class_sessions`, `class_enrolments`, `attendance_records` | `timetable`, `attendance` |

### Parent/learner workspace

| File | Table(s) | Target module |
|---|---|---|
| `src/lib/parent.ts` | `learners`, `enrolments`, `class_sessions`, `attendance_records`, `progress_reports`, `v_invoice_status`, `v_account_statement`, `invoice_lines` | `people` (learners), `enrolment`, `timetable`/`attendance`, `progress-reports`, `billing` (`/billing-accounts/:id/statement`, `/invoices/:id`) |
| `src/app/parent/progress/page.tsx` | `progress_reports` | `progress-reports` |
| `src/app/parent/account/[invoice]/page.tsx` | `v_invoice_status`, `invoice_lines`, `payment_allocations` | `billing` (`GET /invoices/:id`) |
| `src/app/parent/actions.ts` | `messages`, `report_acknowledgements` | `communication`, `progress-reports` (`POST /progress-reports/:id/acknowledge`) |
| `src/app/tutor/actions.ts` | `attendance_records`, `messages` | `attendance`, `communication` |

### Assessment / progress reports (tutor workspace)

| File | Table(s) | Target module |
|---|---|---|
| `src/lib/assessment.ts` | `assessment_types`, `assessment_domains`, `achievement_levels`, `terms`, `assessments`, `learning_plans`, `progress_reports` | `reference` (types/domains/levels/terms), `assessment`, `progress-reports` |

### Messaging

| File | Table(s) | Target module |
|---|---|---|
| `src/lib/messages.ts` | `v_my_threads`, `message_threads`, `messages`, `thread_participants`, `tutors` | `communication` (`GET /threads`, `GET /threads/:id/messages`) |
| `src/components/messages/actions.ts` | `messages` | `communication` |

### Admin: billing, finance, enquiries, enrolments

| File | Table(s) | Target module |
|---|---|---|
| `src/lib/admin.ts` | `learners`, `enrolments`, `tutors`, `contact_enquiries`, `v_operating_surplus`, `v_outstanding_fees`, `v_monthly_revenue`, `v_monthly_expenses`, `v_attendance_rate`, `v_learner_retention`, `v_enquiry_funnel`, `v_break_even` | `enquiries`, `finance` (all the `kpis/*` endpoints), `billing` (`admin/billing/outstanding`) |
| `src/app/admin/billing/page.tsx` | `v_invoice_status`, `billing_accounts`, `v_outstanding_fees`, `payments` | `billing` |
| `src/app/admin/enrolments/page.tsx`, `.../actions.ts` | `package_prices`, `enrolments` | `packages`, `enrolment` |
| `src/app/admin/expenses/page.tsx`, `.../actions.ts` | `expense_categories`, `expenses` | `finance` |
| `src/app/admin/notifications/page.tsx` | `notifications` | `communication` |
| `src/app/admin/actions.ts`, `src/app/(public)/actions.ts` | `contact_enquiries`, `tutors` | `enquiries`, `tutors` |

Total: 15 write sites + ~100 read-call occurrences across 62 unique tables/views, matching the
API plan's own estimate. Every table/view here already has a confirmed, tested API endpoint —
nothing in this list requires new API work; see `src/modules/*/*.controller.ts` for exact routes
not already named above.
