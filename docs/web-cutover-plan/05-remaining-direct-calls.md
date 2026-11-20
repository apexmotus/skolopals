# Remaining direct Supabase calls — migration plan

_Written 2026-11-20. Follows the order in `03-sequencing-and-rollout.md`; this file is the
concrete, file-by-file list of what is left after the auth, reference, public-site and tutor-portal
slices were done._

## Where things stand

**Already API-only:** `apps/client/src/lib/queries.ts`, `apps/client/src/lib/tutor.ts`,
`packages/shared/src/reference.ts`, `getSession()` (`/people/me`), the admin Users screens, and the
tutor Reviews page.

**Stays on Supabase by design** (this is Supabase Auth, not data access): both apps'
`(auth)/actions.ts`, `auth/confirm/route.ts`, `proxy.ts`, the `getClaims` check in
`packages/shared/src/auth.ts`, and the access-token read in `packages/shared/src/api/client.ts`.

**Everything else below still goes straight to Supabase.** RLS protects every one of these calls
because they run as the signed-in user, so this is not a security hole. The cost is that business
rules live in two places, and the app depends on the table shapes the API was built to hide.

## How to do each step

Each step is one PR and follows the same pattern:

1. Add or extend a function in the relevant `lib/*.ts` that calls `api.get` / `api.getPaged` /
   `api.post` etc., returning the API's camelCase DTO.
2. Point the page or action at it, and rename snake_case field access (`full_name` → `fullName`).
3. Map API errors with `ApiError` (status + `code`) instead of parsing Postgres messages with
   `clean()`.
4. Remove the now-unused `createClient` import.
5. **Run the real page against a locally running API.** The client and RLS gaps found so far were
   only caught this way. A mocked test does not catch a wrong assumption about what an endpoint
   returns.

Steps marked **API gap** need an API change first. Land that change, and its spec, in the same PR
or the one before it.

---

## Step 1 — Learners and safety contacts (parent + admin)

Lowest risk, and it covers the newest code, which was written against Supabase directly to match
the pages next to it.

| Call site | Today | Becomes |
| --- | --- | --- |
| `packages/shared/src/learner-edit.ts` `getLearnerForEdit` | `learners`, `learner_emergency_contacts`, `authorised_collectors`, `grades`, `languages` | `GET /learners/:id`, `GET /learners/:id/emergency-contacts`, `GET /learners/:id/collectors`, `getGrades()`/`getLanguages()` from `@skolopals/shared/reference` |
| `learner-edit.ts` `updateLearnerDetails` | `learners` update | `PATCH /learners/:id` |
| `learner-edit.ts` add/remove contact | `learner_emergency_contacts` insert/delete | `POST` / `DELETE /learners/:id/emergency-contacts[/:contactId]` |
| `learner-edit.ts` add/remove collector | `authorised_collectors` insert/delete | `POST` / `DELETE /learners/:id/collectors[/:collectorId]` |
| `apps/client/src/lib/parent.ts` `getLearners`, `getLearner` | `learners` | `GET /learners` (guardian-scoped by RLS), `GET /learners/:id` |
| `apps/admin/src/lib/admin.ts` `getLearners` | `learners` + guardians + enrolments + class placements, embedded | see gap |

**API gaps**
- `UpdateLearnerDto` has no `dateOfBirth`, but the edit form lets you change it. Add it, with the
  same `> 1990-01-01, < today` check the table has.
- The rule "a learner keeps at least one emergency contact" and "next free priority 1–5" are
  currently in `learner-edit.ts`. Move both into the API's `removeEmergencyContact` and
  `addEmergencyContact`, so the rules live in one place.
- The admin Learners list needs guardians, enrolments and current classes for every learner. Doing
  that per learner from the existing endpoints is N+1. Add `GET /admin/learners` (paged) that
  returns one summary row per learner, or add an `include=` option to `GET /learners`.

## Step 2 — Enquiries and enrolment

| Call site | Today | Becomes |
| --- | --- | --- |
| `apps/client/src/app/(public)/actions.ts` `sendEnquiry` | `contact_enquiries` insert | `api.public` `POST /enquiries` (already `@Public`, rate-limited at 5/min) |
| `apps/admin/src/lib/admin.ts` `getEnquiries`; enquiry status in `admin/actions.ts` | `contact_enquiries` | `GET /enquiries`, `PATCH /enquiries/:id` |
| `apps/client/src/app/(public)/enrol/actions.ts` | `rpc("submit_enrolment")` | `POST /enrolments` (`SubmitEnrolmentDto` already has learner, subjects, emergency contacts, collectors, consents, policy version) |
| `apps/admin/src/lib/admin.ts` `getEnrolmentQueue` | `enrolments` + embeds | `GET /enrolments?status=pending` |
| `admin/enrolments/actions.ts` | `rpc("activate_enrolment")`, `enrolments` update (decline) | `POST /enrolments/:id/activate`, `POST /enrolments/:id/decline` |
| `admin/enrolments/page.tsx` | `package_prices` | `GET /packages/:code/price` (or the price already on `GET /packages`) |
| `apps/client/src/lib/parent.ts` `getEnrolments` | `enrolments` | `GET /enrolments` (guardian-scoped) |

**Check while doing it:** that the public enrol form's error message for a non-guardian still
reads "Only a parent or guardian can enrol a learner" after the API maps the error.

## Step 3 — Timetable and attendance

| Call site | Today | Becomes |
| --- | --- | --- |
| `admin/timetable/actions.ts` terms, rooms | `terms`, `rooms` insert | `POST /reference/terms`, `POST /reference/rooms` |
| `admin/timetable/actions.ts` create class | `class_groups` insert, then `class_group_grades` insert, then a manual compensating **delete** if the second step fails | `POST /class-groups` with `gradeCodes`. It checks tutor competency and writes atomically, so the hand-rolled rollback goes away |
| `admin/timetable/actions.ts` schedules, generate | `class_schedules`, `rpc("generate_class_sessions")` | `POST /class-groups/:id/schedules`, `POST /class-groups/:id/generate-sessions` |
| `admin/timetable/page.tsx` | `terms`, `rooms`, `class_groups` | `GET /reference/terms`, `GET /reference/rooms`, `GET /class-groups` |
| `apps/client/src/lib/parent.ts` `getUpcomingSessions` (parent overview/timetable, learner overview/timetable) | `class_sessions` + `class_groups(name, delivery_mode, subjects, rooms)` | `GET /class-sessions?fromDate=` plus `GET /class-groups/:id` for names |
| `tutor/register/page.tsx` | `class_sessions`, `class_enrolments`, `attendance_records` | `getMySessions`, `GET /class-groups/:id/enrolments`, `GET /class-sessions/:id/attendance` |
| `tutor/actions.ts` mark attendance | `attendance_records` | `POST /class-sessions/:id/attendance` |
| `apps/client/src/lib/parent.ts` `getAttendance` | `attendance_records` + embeds | see gap |

**API gaps**
- `ClassSessionDto` carries `classGroupId` only, so every timetable view has to look up the class
  name, subject, room and delivery mode separately. Add those fields to the DTO, or add a
  `GET /class-sessions/mine` that returns them, rather than making N calls.
- There is no "attendance for my learners" read for a parent. Add `GET /learners/:id/attendance`.
- `ClassSessionDto.meetingUrl` exists (column `class_sessions.meeting_url`). The learner timetable
  can show the meeting link once it reads from the API. The earlier note that there was no
  meeting-link column was wrong: it is on the session, not the class.

## Step 4 — Assessment and progress reports

| Call site | Today | Becomes |
| --- | --- | --- |
| `apps/client/src/lib/assessment.ts` reference lists | `achievement_levels`, `assessment_types`, `assessment_domains`, `terms` | `GET /reference/achievement-levels`, `/assessment-types`, `/assessment-domains`, `/terms` |
| `lib/assessment.ts` `assessments`, `learning_plans` | direct reads | `GET /learners/:id/assessments`, `GET /learners/:id/learning-plans` |
| `tutor/assessments/actions.ts` | `rpc("record_assessment")`, `rpc("create_learning_plan")` | `POST /learners/:id/assessments`, `POST /learners/:id/learning-plans` |
| `tutor/reports/actions.ts` | `rpc("save_progress_report")` | `PUT /learners/:id/progress-reports/:termId` |
| `lib/assessment.ts`, `parent/progress/page.tsx`, `lib/parent.ts` `getPublishedReports` (also the learner reports page) | `progress_reports` + subjects + acknowledgements | `GET /learners/:id/progress-reports` per learner (the DTO already includes `acknowledgements`) |
| `parent/actions.ts` `acknowledgeReport` | `report_acknowledgements` insert | `POST /progress-reports/:id/acknowledge` |

**Possible gap:** the tutor reports screen lists drafts across all of a tutor's learners, which
means one call per learner. That is fine at current class sizes. Add a tutor-scoped list only if it
shows up as slow.

## Step 5 — Messaging and notifications

| Call site | Today | Becomes |
| --- | --- | --- |
| `apps/client/src/lib/messages.ts` | `v_my_threads`, `message_threads`, `messages`, `thread_participants`, `tutors` | `GET /threads`, `GET /threads/:id/messages`, `GET /tutors` |
| `components/messages/actions.ts`, `parent/actions.ts`, `tutor/actions.ts` send | `messages` insert | `POST /threads/:id/messages` |
| `components/messages/actions.ts` | `rpc("start_thread")`, `rpc("mark_thread_read")` | `POST /threads`, `POST /threads/:id/read` |
| `admin/notifications/page.tsx` | all `notifications` + recipients | see gap |

**API gap:** `GET /notifications` returns the caller's own notifications. The admin page lists
every notification the centre has sent, with read receipts. Add `GET /admin/notifications`.

## Step 6 — Tutors (admin side)

| Call site | Today | Becomes |
| --- | --- | --- |
| `admin/tutors/actions.ts` | `rpc("create_tutor")`, `rpc("set_tutor_competency")`, `rpc("set_tutor_pay_rate")`, `tutor_competencies`, `tutor_spoken_languages` | `POST /tutors`, `PUT /tutors/:id/competencies`, `PUT /tutors/:id/pay-rates`, `PUT /tutors/:id/spoken-languages` |
| `admin/tutors/[id]/page.tsx`, `lib/admin.ts` `getTutors` | `tutors` + embeds | see gap |
| `admin/tutors/actions.ts` **and** `admin/actions.ts` tutor status | `tutors` update | see gap |

**API gaps**
- `GET /tutors` is the public directory and returns active tutors only. Admin needs every tutor,
  including inactive ones, with competencies. Add `GET /admin/tutors` (or an admin-only
  `?status=all`).
- There is no endpoint to change a tutor's status (only `PATCH /tutors/me`). Add
  `PATCH /tutors/:id/status` (admin).
- The status update is implemented twice, in `admin/actions.ts` and `admin/tutors/actions.ts`.
  Delete one while migrating.

## Step 7 — Billing, finance and the dashboard

Done last, as `03-sequencing-and-rollout.md` already decided, because this is where a mistake costs
money.

| Call site | Today | Becomes |
| --- | --- | --- |
| `admin/billing/actions.ts` | `rpc("run_monthly_invoices")`, `rpc("apply_late_fees")`, `rpc("record_payment")` | `POST /billing/run-monthly-invoices`, `POST /billing/apply-late-fees`, `POST /billing-accounts/:id/payments` |
| `admin/billing/page.tsx` | `billing_accounts`, `payments`, `v_invoice_status`, `v_outstanding_fees` | `GET /admin/billing/outstanding`, plus the gap below |
| `apps/client/src/lib/parent.ts` `getAccount` | `v_invoice_status`, `v_account_statement` | `GET /billing-accounts/me`, `GET /billing-accounts/:id/invoices`, `GET /billing-accounts/:id/statement` |
| `parent/account/[invoice]/page.tsx`, `lib/parent.ts` `getInvoiceLines` | `v_invoice_status`, `invoice_lines`, `payment_allocations` | `GET /invoices/:id` (includes `lines` and the derived status) |
| `admin/expenses/*` | `expenses`, `expense_categories` | `GET/POST /finance/expenses`, `GET /finance/expense-categories` |
| `apps/admin/src/lib/admin.ts` `getKpis` | eight `v_*` views | `GET /finance/kpis/*` (all eleven exist) |
| `lib/admin.ts` `getDashboard` | counts on `learners`, `enrolments`, `tutors`, `contact_enquiries`; `v_operating_surplus`, `v_outstanding_fees` | `kpis/learner-counts`, `GET /enrolments?status=pending` (`meta.totalCount`), `GET /enquiries?status=new`, `kpis/operating-surplus`, `admin/billing/outstanding` |

**API gaps**
- The admin billing page lists invoices and payments across **all** accounts. The API only has
  per-account lists plus `outstanding`. Add `GET /admin/billing/invoices` and
  `GET /admin/billing/payments` (paged, filterable by month and status).
- Check that `InvoiceDto` exposes the payment allocations the parent invoice page shows. If it
  only has the derived status, add the allocations to the DTO.
- **Before migrating:** the late-fee compounding and KPI view defects recorded from UAT
  (`docs/UAT-TEST-DATA.md`) are in the database functions both paths call. Fix them first so the
  migration is not blamed for them.

## Step 8 — Resources

| Call site | Today | Becomes |
| --- | --- | --- |
| `apps/client/src/lib/parent.ts` `getResources` (parent + learner Resources pages) | `resources` + `subjects(name)` | `GET /resources`, with subject names from `getSubjects()` |

No gap. This step is small enough to fold into any of the others.

## Step 9 — Cleanup

Once `grep -rnE '\.(from|rpc)\(' apps/*/src packages/*/src` finds nothing outside the auth files
listed at the top:

- Delete the remaining `createClient` imports and the `clean()` Postgres-message helpers.
- Decide whether to trim `database.types.ts` to what the auth flow still needs (`profiles`,
  `user_roles`) or keep it fully generated (still open, as in `03`).
- Optionally add a lint rule (`no-restricted-syntax` on `.from(` / `.rpc(`) so new pages can't
  slip back to direct access. That is how this list grew again during the 2026-11-20 page work.

## API work, in one list

For planning the API side ahead of the web PRs:

1. `PATCH /learners/:id`: accept `dateOfBirth`.
2. Emergency contacts: enforce at least one contact and assign the next free priority, in the API.
3. `GET /admin/learners`: summary with guardians, enrolments and current classes.
4. `ClassSessionDto`: add class name, subject, room and delivery mode (or `GET /class-sessions/mine`).
5. `GET /learners/:id/attendance` for parents.
6. `GET /admin/notifications`.
7. `GET /admin/tutors` (all statuses) and `PATCH /tutors/:id/status`.
8. `GET /admin/billing/invoices`, `GET /admin/billing/payments`; confirm `InvoiceDto` has
   allocations.
