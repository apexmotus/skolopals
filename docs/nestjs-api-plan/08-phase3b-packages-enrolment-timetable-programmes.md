# Phase 3b — Packages, Enrolment, Timetable/Attendance, Programmes

Depends on Phase 3a (learners, guardians, tutors, subject offerings). Build order within this
slice: **`packages` → `enrolment` → `timetable` → `attendance` → `programmes`**. `enrolment`
needs `packages` to price itself; `timetable` needs `tutors`' competency data (3a) to validate
assignment; `attendance` needs `timetable`'s sessions; `programmes` is independent of
`timetable` internally but reuses the exact same capacity-locking pattern, so building it right
after `timetable` means the pattern is fresh.

## Modules, endpoints, business rules, SPs

Fully specified in `03-endpoints-and-business-rules.md` (§`packages`, §`enrolment`,
§`timetable`, §`attendance`, §`programmes`) and `02-sp-catalogue.md` (same section headers).

## Tasks specific to this slice

1. `packages`: straightforward CRUD — the overlap guards (`usp_PackagePrice_Create`,
   `usp_BillingSettings_Create`) are already enforced by the existing `EXCLUDE USING GIST`
   constraints (native Postgres, unchanged; Phase 0 §5 voids this as a translation problem).
   Nothing to build here beyond the ordinary write path and surfacing the constraint violation
   through `SqlErrorMapper`.
2. `enrolment`: `usp_Enrolment_Submit` is the single most complex write in the whole catalogue
   (five `jsonb` parameters, a learner creation, a consent check, a subject-allowance check).
   Build and thoroughly unit-test the Manager method that assembles its `jsonb` payloads from
   the request DTO *before* wiring the controller — the DTO→payload mapping is where a
   silently-dropped field would hide (e.g. a missing emergency contact row never reaching the
   function, vs. the function correctly rejecting an empty array). `usp_Enrolment_Activate`
   depends on `usp_Invoice_NextNumber` (billing module's function, not yet built as a *module*
   until Phase 3d) — the function itself already exists in the live schema, but the
   **billing module's NestJS code** doesn't exist yet. Resolve this dependency by having
   `EnrolmentManager.activate()` call `BillingRepository`/`InvoiceSequenceRepository` directly
   (inject the minimal repository, not the whole `billing` Manager, to keep the layering per
   generic spec §4.2's "Manager may call other Managers" — calling another module's Manager is
   allowed; calling its Repository is not, per §4.1–4.3 — so either promote
   `usp_Invoice_NextNumber`'s caller to `BillingManager.allocateInvoiceNumber()` and have
   `EnrolmentManager` depend on `BillingManager`, built in skeleton form now and fleshed out in
   3d, or sequence billing's minimal invoice-numbering piece into this slice instead. **Decide
   explicitly and record the choice in code** rather than reaching for the repository directly,
   which the generic spec's layer rules forbid even when it's convenient.
3. `timetable`: confirm `usp_ClassGroup_CheckTutorCompetent`'s real implementation (deferred
   constraint trigger or a dedicated read, per the Phase 0 §6 audit) against real data from 3a's
   seeded competencies before writing `usp_ClassGroup_Create`'s happy path — a false negative
   here (rejecting a legitimately competent tutor) is the complaint an admin will actually file;
   test the exact medium-of-instruction edge case from the schema's own comments ("Physical
   Sciences in Afrikaans and Mathematics in English... must not imply Mathematics in Afrikaans").
4. `attendance` + `programmes`: `usp_ClassEnrolment_Place` already takes the `for update` lock
   correctly (confirmed fixed); `usp_ProgrammeEnrolment_Book` does **not** yet — apply the Phase
   0 §4 fix migration before or during this slice, then write a concurrency test for **both**
   (fire N parallel placement/booking requests at a capacity-1 class/programme, assert exactly 1
   succeeds) — don't ship this slice without both tests passing, since one is a regression check
   and the other is proving a fix that didn't exist before this plan.

## Verify

- `pnpm lint && pnpm test && pnpm test:e2e` pass for all five modules.
- Every endpoint in the four endpoint tables exists with the specified shape; Swagger complete.
- The concurrency test from task 4 passes reliably (run it more than once in CI if it's at all
  flaky — a flaky capacity test is a real bug hiding, not a timing fluke to suppress).
- Manager tests cover every business rule listed for these five modules in
  `03-endpoints-and-business-rules.md`: subject-allowance limit, billing-contact-required-to-
  activate, required-consents-required-to-activate, registration-fee-once-per-learner,
  tutor-competency-match, operating-hours check, collector-authorisation check.
