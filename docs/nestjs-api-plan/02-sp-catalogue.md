# Section 1.6 — Stored Procedure Catalogue

**Rewritten 2026-11-05 for Postgres/Supabase, superseding the SQL-Server version of this
file.** The biggest change: this is largely **already built**. The current Postgres schema
already exposes most of these as `.rpc()`-callable functions (that's how `web/` calls them
today via `@supabase/supabase-js`). This catalogue's job is now to document the API-facing
contract for each one — not to design it from scratch — and to flag, per entry, whether it maps
to an existing function as-is, needs a signature tweak, or is genuinely new. **That audit against
the real `db/migrations/*.sql` definitions is still outstanding** (see
`04-phase0-schema-port-and-cutover-strategy.md` §6) — treat every entry below as the *intended*
contract, confirm it against the actual function signature before wiring a repository method to
it, module by module, during Phase 3.

## Conventions (adapted)

- Naming below keeps the `usp_<Entity>_<Action>` logical label purely as a catalogue
  cross-reference key — it is **not** the real Postgres function name. The actual functions use
  this project's existing snake_case convention (e.g. `submit_enrolment`, not
  `usp_Enrolment_Submit`); resolve the real name per entry during the Phase 0 §6 audit and
  record it here once confirmed, rather than guessing a new snake_case name that might not match
  what already exists.
- **IDs**: Postgres primary keys here are `gen_random_uuid()` defaults, already in place — no
  change needed, and no reason to move id generation into the Manager layer the way the SQL
  Server version of this file required. `Create` functions can keep returning the generated id
  as part of their result set, same as today.
- **Row-level authorization stays RLS's job, not the SP's.** This is the single biggest
  simplification from the SQL-Server version of this file: no `@ActorUserId`/`@ActorIsAdmin`
  parameters threaded through every call, no `WHERE`/`IF` logic reproducing `private.*` helper
  functions inside each SP. The existing RLS policies (which already call `private.*`) do this
  automatically once the API's connection carries the actor's JWT claims per
  `04-phase0...md` §1 — a function can usually stay exactly as it already reads the table, and
  an unauthorized actor simply gets zero rows back (RLS filters the underlying `SELECT`), or a
  Postgres-raised error on a write RLS's `WITH CHECK` rejects. Only business rules that genuinely
  aren't expressible as a row-visibility policy (e.g. "refuse this specific action with a
  meaningful error" rather than "silently return nothing") need explicit logic inside the
  function itself — call this out per entry below where it applies, don't add it by default.
- **No Table-Valued Parameters.** Postgres natively accepts arrays and `jsonb` as function
  parameters — exactly what the existing RPCs (e.g. `submit_enrolment`'s five JSON blobs) already
  do. There is nothing to design here; pass arrays/objects straight through from the Manager.
- **Deferred constraint triggers** (subject-allowance count, payment-allocation-within-payment,
  invoice-not-oversettled) are native Postgres (`CREATE CONSTRAINT TRIGGER ... DEFERRABLE
  INITIALLY DEFERRED`) and already exist in the schema — no end-of-batch validation step needs
  adding to any SP; the trigger still fires at transaction commit exactly as it does today.
- Every SP not listed with a full block below is a straightforward CRUD function whose Row
  shape is read directly off the existing table/view definition in the named
  `db/migrations/*.sql` file — no type-mapping table is needed since there's only one schema.
  The "CRUD SP index" at the end of this file names every one of those so none is missed, and
  `03-endpoints-and-business-rules.md` states which repository method each endpoint calls.
- **`Raises:` entries below use the generic spec's semantic error-code names
  (`VALIDATION_FAILED`/`FORBIDDEN`/`NOT_FOUND`/`CONFLICT`/`BUSINESS_RULE_VIOLATION`) instead of
  SQL Server `THROW` numbers** (the mapping is 1:1 and engine-agnostic — see generic spec §5.6).
  How each one is actually signalled by a Postgres function is still to be confirmed per
  function during the Phase 0 §6 audit: some already exist as a Postgres `RAISE EXCEPTION` with
  a distinguishable message or custom SQLSTATE the existing `web/` code already parses (check
  `web/src/`'s error-handling around each `.rpc()` call site for the current convention before
  inventing a new one), some may currently rely on a plain constraint violation (`23505` unique,
  `23514` check) that `SqlErrorMapper` maps directly without the function raising anything
  itself. Phase 1's `SqlErrorMapper` must handle both patterns, not just the custom-raise one.

---

## Auth

**Voided entirely — not replaced, just removed.** The SQL-Server version of this file had a
full `usp_User_*`/`usp_RefreshToken_*` section here because that plan replaced Supabase Auth.
This plan keeps Supabase Auth (`04-phase0...md` §2); there is no user-creation, login, token-
issuance, or confirmation-token SP in this API at all. The only auth-adjacent read this API owns
is "get the current actor's profile/roles given a verified JWT `sub`," which is just the
ordinary `people`/`users` read path below (`usp_User_GetById` equivalent), not a special auth-
module SP.

---

## People / safeguarding (full blocks for the pieces with real logic; rest in the CRUD index)

```
SP:            usp_Learner_GetById (logical name — confirm real function/query during audit)
Module:        people
Kind:          read
Purpose:       Returns one learner if the actor is entitled to see it. Entitlement (guardian,
                the learner themself, a teaching tutor, or admin) is already enforced by RLS
                (`private.can_view_learner`, kept live per Phase 0 §1-§2) — this read does not
                need its own `ActorUserId`/`ActorIsAdmin` parameters or visibility logic; it
                queries the table/view directly and RLS does the filtering.
Input params:  LearnerId:uuid:required
Result sets:   1) LearnerId uuid, ProfileId uuid null, FullName text,
                   DateOfBirth date, GradeCode text, SchoolName text,
                   HomeLanguageCode text null, Status text, JoinedOn date,
                   LeftOn date null, CreatedAt timestamptz
Raises:        none (not entitled → RLS filters the row to empty, Manager throws 404, never
                403 — do not confirm existence to an unauthorised caller)
Idempotent:    yes

SP:            usp_Learner_Create (logical name — confirm real function during audit)
Module:        people
Kind:          write
Purpose:       Registers a learner outside the enrolment flow (admin walk-in path). Most
                learner creation goes through usp_Enrolment_Submit instead.
Input params:  LearnerId:uuid:required, FullName:text:required,
                DateOfBirth:date:required, GradeCode:text:required,
                SchoolName:text:nullable, HomeLanguageCode:text:nullable,
                Status:text:required
Result sets:   none
Raises:        VALIDATION_FAILED if DateOfBirth outside 1990-01-01..today (already an existing
                  CHECK constraint, unchanged)
Idempotent:    no

SP:            usp_LearnerMedicalNotes_Upsert (logical name — confirm real function during
                  audit)
Module:        people
Kind:          write
Purpose:       Admin/guardian-only special personal information (POPIA s26). Tutors must never
                reach this repository method at all — enforced by both RLS (kept live) and the
                Manager not exposing it outside the people module, not by a role check alone,
                since even an accidentally-reachable endpoint must not leak this data.
Input params:  LearnerId:uuid:required, Allergies:text:required,
                Conditions:text:required, Medication:text:required,
                Accommodations:text:required, UpdatedBy:uuid:required
Result sets:   none
Raises:        none
Idempotent:    yes (upsert)

SP:            usp_AuthorisedCollector_IsActiveFor (real function:
                  `private.check_collector_authorised`, exists)
Module:        people
Kind:          read
Purpose:       Used by attendance's sign-out flow, not a standalone endpoint.
Input params:  CollectorId:uuid:required, LearnerId:uuid:required,
                OnDate:date:required
Result sets:   1) IsActive boolean (single row, single column)
Raises:        none
Idempotent:    yes
```

---

## Tutors

```
SP:            usp_Tutor_Create (logical name — real function: `public.create_tutor`, exists)
Module:        tutors
Kind:          write
Purpose:       Admin creates a tutor record for an EXISTING account (tutors are never
                self-applied, BR-23). The existing-user lookup is against Supabase's own
                `auth.users` (unchanged — no new Users table; Supabase Auth is kept per
                Phase 0 §2).
Input params:  TutorId:uuid:required, Email:text:required,
                Slug:text:required, EmploymentType:text:required,
                Headline:text:nullable
Result sets:   none
Raises:        NOT_FOUND if no auth.users row exists for Email ("ask them to sign up first" —
                existing message), CONFLICT if that user is already a tutor
Idempotent:    no
Notes:         Also inserts UserRoles ('tutor') in the same statement — already how
                `create_tutor` works today; confirm during the Phase 0 §6 audit, no port needed.

SP:            usp_Tutor_SetCompetency (real function: `public.set_tutor_competency`, exists)
Module:        tutors
Kind:          write
Purpose:       Upserts one (tutor, subject, grade) competency and replaces its media
                (languages of instruction) wholesale.
Input params:  CompetencyId:uuid:required, TutorId:uuid:required,
                SubjectCode:text:required, GradeCode:text:required,
                Languages:text[]:required (native Postgres array parameter, not a TVP)
Result sets:   none
Raises:        VALIDATION_FAILED if Languages is empty ("choose at least one language of
                instruction")
Idempotent:    yes (upsert + wholesale replace of media rows)

SP:            usp_Tutor_SetPayRate (real function: `public.set_tutor_pay_rate`, exists)
Module:        tutors
Kind:          write
Purpose:       Closes the tutor's currently-open pay rate (if any) as of the new
                EffectiveFrom, then inserts the new one — already relies on the existing
                Postgres `EXCLUDE` constraint (native, unchanged; Phase 0 §5 voids any
                "no-overlap ranges" translation work — there's nothing to translate).
Input params:  PayRateId:uuid:required, TutorId:uuid:required,
                PayBasis:text:required, AmountCents:integer:required,
                EffectiveFrom:date:required
Result sets:   none
Raises:        VALIDATION_FAILED if AmountCents <= 0
Idempotent:    no
Notes:         Runs inside one transaction (close-previous-rate UPDATE + new-rate INSERT) —
                already how the existing function works; no change needed.

SP:            usp_TutorDocument_List (logical name — confirm real function/view during audit)
Module:        tutors
Kind:          read
Purpose:       Admin-only. Lists uploaded vetting documents with their storage path (Phase 0
                §3 — StoragePath points at the Supabase Storage bucket, not a DB blob).
Input params:  TutorId:uuid:required
Result sets:   1) TutorDocumentId uuid, DocType text, StoragePath text,
                   UploadedAt timestamptz, VerifiedAt timestamptz null, VerifiedBy uuid null
Raises:        none
Idempotent:    yes
```

---

## Enrolment

```
SP:            usp_Enrolment_Submit (real function: `public.submit_enrolment`, exists)
Module:        enrolment
Kind:          write
Purpose:       One guardian-initiated transaction: creates the learner, the guardian link
                (primary + billing contact), emergency contacts, authorised collectors, POPIA
                consents, the pending enrolment and its subject selections. All-or-nothing —
                a learner created without consent is a POPIA problem, not a recoverable
                partial state.
Input params:  LearnerId:uuid:required, EnrolmentId:uuid:required,
                GuardianId:uuid:required (the authenticated actor — never client-supplied),
                FullName:text:required, DateOfBirth:date:required,
                GradeCode:text:required, SchoolName:text:nullable,
                HomeLanguageCode:text:nullable, Relationship:text:nullable,
                PackageCode:text:required, PreferredTutorId:uuid:nullable,
                PolicyVersion:text:required,
                Subjects:jsonb:required (already a native `jsonb` parameter today — no TVP
                  equivalent needed),
                Emergency:jsonb:required (must have ≥1 row — checked by the Manager before
                  calling, per generic spec §4.2: Manager validates business rules, not the
                  controller),
                Collectors:jsonb:required (may be empty),
                Consents:jsonb:required
Result sets:   1) EnrolmentId uuid (single row, single column — confirms the id was committed)
Raises:        BUSINESS_RULE_VIOLATION if fewer required-consent types are granted than exist
                  in ConsentTypes.IsRequired=true (already checked inside the existing
                  function against the `jsonb` payload, up front, so an incomplete submission
                  never creates a learner row at all — no change needed)
Idempotent:    no

SP:            usp_Enrolment_Activate (real function: `public.activate_enrolment`, exists)
Module:        enrolment
Kind:          write
Purpose:       Admin approval: sets the enrolment active, assigns the tutor, opens a billing
                account if the family doesn't have one, and raises the once-off registration
                invoice immediately (never charged twice per learner).
Input params:  EnrolmentId:uuid:required, AssignedTutorId:uuid:nullable,
                StartDate:date:required, FirstMonthAmountCents:integer:nullable,
                FirstMonthReason:text:nullable, ActorUserId:uuid:required
                  (becomes FirstMonthSetBy when FirstMonthAmountCents is supplied),
                NewInvoiceNumber:text:nullable (see usp_Invoice_NextNumber below — Manager
                  calls that first, inside the same transaction, then passes the result in;
                  this function does not allocate the invoice number itself, to keep numbering
                  in one place)
Result sets:   1) InvoiceId uuid null (null if registration was already invoiced for this
                   learner on a prior enrolment and nothing new was raised)
Raises:        NOT_FOUND if EnrolmentId not found, BUSINESS_RULE_VIOLATION if status is not
                  'pending', BUSINESS_RULE_VIOLATION if the learner has no billing contact
                  (already enforced today — the `enrolment_requires_billing_contact` deferred
                  constraint trigger, native Postgres, unchanged; Phase 0 §5 voids any
                  "deferred trigger" translation work)
Idempotent:    no (re-activating an already-active enrolment is rejected, not a no-op)
Notes:         Already locks the Enrolments row with `for update` at the start to guard
                against concurrent double-activation (confirm this is still present in the
                live function during the Phase 0 §6 audit) — no change needed; this is exactly
                the kind of thing the SQL-Server version of this file would have had to
                re-implement as `WITH (UPDLOCK, HOLDLOCK)` and this version does not.
```

---

## Timetable / attendance

```
SP:            usp_ClassGroup_GenerateSessions (real function: `public.generate_class_sessions`,
                  exists)
Module:        timetable
Kind:          write
Purpose:       Materialises one ClassSession per scheduled weekday inside the class group's
                term. Safe to re-run after adding a schedule row — fills only the gap.
Input params:  ClassGroupId:uuid:required
Result sets:   1) CreatedCount integer (single row, single column)
Raises:        none beyond FORBIDDEN if the actor isn't admin (checked in the Manager via
                  @Roles, not duplicated in the function — never reachable except through the
                  admin-only controller route)
Idempotent:    yes — already uses `ON CONFLICT DO NOTHING` against the (ClassGroupId,
                  SessionDate, StartsAt) unique constraint, and native `generate_series` for
                  the date iteration. No change needed (Phase 0 §5 voids any
                  "generate_series" translation work — there is nothing to replace it with).

SP:            usp_ClassEnrolment_Place (logical name — confirm real function during audit,
                  likely the write path behind `class_enrolments`)
Module:        timetable
Kind:          write
Purpose:       Places a learner in a class group, enforcing capacity under concurrency. The
                `check_class_capacity` trigger it depends on already locks the `class_groups`
                row with `for update` before counting (db/migrations/20261020000006) — this
                bug class was found and fixed once already, per project memory; nothing to
                re-fix here.
Input params:  ClassEnrolmentId:uuid:required, ClassGroupId:uuid:required,
                LearnerId:uuid:required, EnrolmentId:uuid:required
Result sets:   none
Raises:        BUSINESS_RULE_VIOLATION "Class is full (capacity %d)" if the count of
                  currently-placed learners (LeftOn IS NULL) would exceed ClassGroups.Capacity
Idempotent:    no
Notes:         Already takes `select ... from class_groups where id = ... for update` as the
                  first statement before the count query (confirmed fixed, Phase 0 §4) — no
                  change needed. Re-confirm this still holds when called through the new API's
                  direct-Postgres connection, not just when called via PostgREST — this is the
                  single highest-risk item in the whole plan if it silently stopped applying;
                  see Phase 0 §6's concurrency-test requirement.

SP:            usp_ClassGroup_CheckTutorCompetent (logical name — confirm real function/trigger
                  during audit)
Module:        timetable
Kind:          read
Purpose:       Validates that a class group's tutor is recorded as competent (subject, every
                grade on the class, medium of instruction) before the class is created/updated
                — already enforced today via a deferred constraint trigger (native Postgres,
                unchanged; Phase 0 §5 voids any translation work here). If the Manager wants a
                pre-check read (to give a friendlier error before attempting the write, rather
                than relying on the trigger firing at commit), this read-only helper can stay
                as a thin wrapper; it is not required to replace the trigger, only to improve
                the error message's timing.
Input params:  TutorId:uuid:required, SubjectCode:text:required,
                LanguageCode:text:required, GradeCodes:text[]:required (native array)
Result sets:   1) MissingGradeCode text (zero rows = fully competent; one row per grade the
                   tutor is NOT recorded as teaching in that subject/medium)
Raises:        none (Manager throws BUSINESS_RULE_VIOLATION listing the missing grades if any
                  rows come back)
Idempotent:    yes

SP:            usp_SessionCheckIn_Record (logical name — confirm real function during audit)
Module:        attendance
Kind:          write
Purpose:       Sign a learner in or out, verifying the collector is authorised FOR THIS LEARNER
                and active on the day (already enforced by the existing
                `check_collector_authorised` logic — unchanged).
Input params:  CheckInId:uuid:required, ClassSessionId:uuid:required,
                LearnerId:uuid:required, SignedInBy:uuid:nullable,
                DepartedAt:timestamptz:nullable, CollectedBy:uuid:nullable,
                SignedOutBy:uuid:nullable
Result sets:   none
Raises:        BUSINESS_RULE_VIOLATION "Collector is not authorised for this learner" if
                  CollectedBy is supplied and usp_AuthorisedCollector_IsActiveFor (called
                  inline, not as a separate round trip) returns false
Idempotent:    no
```

---

## Assessment / progress

```
SP:            usp_Assessment_Record (real function: `public.record_assessment`, exists)
Module:        assessment
Kind:          write
Purpose:       Records an assessment with its per-domain scores in one transaction — a
                scoreless assessment is not a partial record, it is useless, so both are
                required together.
Input params:  AssessmentId:uuid:required, LearnerId:uuid:required,
                AssessmentTypeCode:text:required, GradeCode:text:required,
                AssessedOn:date:required, SubjectCode:text:nullable,
                TermId:uuid:nullable, Notes:text:nullable,
                AdministeredBy:uuid:nullable (the actor's TutorId, resolved by the Manager;
                  null if the actor is admin-not-tutor),
                Scores:jsonb:required (≥1 row — already native, no TVP equivalent needed)
Result sets:   1) AssessmentId uuid
Raises:        BUSINESS_RULE_VIOLATION if Scores is empty
Idempotent:    no
Notes:         The achievement-level-from-percentage derivation
                (`round(raw*100/max) between min_percent and max_percent`) is already computed
                per score row inside the function by joining to AchievementLevels — not
                pre-computed by the Manager, so the one place the banding rule lives stays the
                database. No change needed.

SP:            usp_LearningPlan_Create (real function: `public.create_learning_plan`, exists)
Module:        assessment
Kind:          write
Purpose:       Supersedes the learner's current active plan (if any) and creates a new one
                with its goals, in one transaction — a learner has at most one active plan,
                enforced by a filtered unique index (`WHERE Status = 'active'`), so the old one
                MUST be closed first in the same transaction.
Input params:  LearningPlanId:uuid:required, LearnerId:uuid:required,
                FromAssessmentId:uuid:nullable, TermId:uuid:nullable,
                CreatedBy:uuid:required,
                Goals:jsonb:required (≥1 row)
Result sets:   1) LearningPlanId uuid
Raises:        BUSINESS_RULE_VIOLATION if Goals is empty
Idempotent:    no

SP:            usp_ProgressReport_Save (real function: `public.save_progress_report`, exists)
Module:        progress-reports
Kind:          write
Purpose:       Upserts a termly report and wholesale-replaces its per-subject detail (a report
                is edited as a document, not row by row). Optionally publishes it — a one-way
                transition; once published, never silently unpublished.
Input params:  ProgressReportId:uuid:required, LearnerId:uuid:required,
                TermId:uuid:required, TutorId:uuid:nullable,
                Summary:text:nullable, AttendanceNote:text:nullable,
                CreatedBy:uuid:required, Publish:boolean:required,
                Subjects:jsonb:required (≥1 row)
Result sets:   1) ProgressReportId uuid
Raises:        BUSINESS_RULE_VIOLATION if Subjects is empty, BUSINESS_RULE_VIOLATION if
                  Publish=true and the report (after this save) still has zero subject rows
                  (defensive — cannot actually occur given the prior check; already enforced
                  by the existing `check_report_publishable` deferred constraint trigger,
                  native Postgres, unchanged, as belt-and-braces)
Idempotent:    yes (upsert on (LearnerId, TermId))
```

---

## Billing

```
SP:            usp_Invoice_NextNumber (real function: `private.next_invoice_number`, exists)
Module:        billing
Kind:          write
Purpose:       Allocates the next sequential invoice number for the invoice's year under a row
                lock, so two concurrent invoice runs can never produce the same number.
Input params:  IssuedOn:date:required
Result sets:   1) InvoiceNumber text (e.g. "SKP-2026-0042")
Raises:        none
Idempotent:    no — each call consumes the next number. Caller (usp_Enrolment_Activate,
                  usp_Billing_RunMonthlyInvoices, usp_Billing_ApplyLateFees) must call it at
                  most once per invoice actually raised, inside the same transaction as the
                  invoice INSERT, so a rolled-back transaction doesn't burn a number that then
                  shows as a gap — acceptable (gaps are fine for an invoice sequence).
Notes:         Already implemented via `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
                (native Postgres, already safe under concurrency) — no change needed.

SP:            usp_Billing_RunMonthlyInvoices (real function: `public.run_monthly_invoices`,
                  exists)
Module:        billing
Kind:          write
Purpose:       Bills every active monthly-package enrolment for the target month, catching up
                any earlier unbilled month (how a learner who joined after the 15th still gets
                billed for the gap). Safe to call twice: a month already billed for an
                enrolment is structurally un-rebillable (filtered unique index on
                (EnrolmentId, PeriodMonth) where LineType='package').
Input params:  Period:date:nullable (defaults, if null, to the first day of next calendar
                  month — computed by the Manager, not left as a SQL default, so the "what did
                  this actually bill" value is always visible in the call the Manager logs)
Result sets:   1) InvoiceId uuid, BillingAccountId uuid,
                   TotalCents bigint — one row per invoice touched by this run (new or added-to)
Raises:        NOT_FOUND if no BillingSettings row is in effect for the target month
Idempotent:    yes (by construction, via the filtered unique index above — not by a
                  check-then-skip race, which would not be safe under concurrency; the index
                  IS the safety, the pre-check is just there to keep the run's log quiet)
Notes:         Already uses native `generate_series(date, date, '1 month')` for the month
                  iteration — no change needed (Phase 0 §5 voids any "generate_series"
                  translation work). The repository's `retryOnDeadlock` setting can stay
                  `true` for this call — a deadlock aborting it partway is safe to blind-retry
                  because of the unique index; call this out explicitly in the repository so
                  the next person doesn't have to re-derive it.

SP:            usp_Billing_ApplyLateFees (real function: `public.apply_late_fees`, exists)
Module:        billing
Kind:          write
Purpose:       Charges a R150 (configurable via BillingSettings.LateFeeCents) late fee on the
                next invoice an overdue account receives, for every issued invoice past its
                grace period that hasn't already had a late fee line raised against it
                (filtered unique index on (LateFeeForInvoiceId) where LineType='late_fee').
Input params:  OnDate:date:nullable (defaults to today if null — resolved by the Manager)
Result sets:   1) LateFeeCount integer (single row, single column)
Raises:        none (returns 0 if no BillingSettings row is in effect for OnDate, matching the
                  function's existing early `return 0`)
Idempotent:    yes, same reasoning as usp_Billing_RunMonthlyInvoices

SP:            usp_Billing_RecordPayment (real function: `public.record_payment`, exists)
Module:        billing
Kind:          write
Purpose:       Records a payment and allocates it to the billing account's oldest unpaid
                invoice first (by DueOn, then IssuedOn) until exhausted; any remainder is left
                unallocated (shows as a credit on the statement, picked up by a future
                allocation).
Input params:  PaymentId:uuid:required, BillingAccountId:uuid:required,
                AmountCents:integer:required, Method:text:required,
                Reference:text:nullable, PaidOn:date:required,
                RecordedBy:uuid:required
Result sets:   1) PaymentId uuid
Raises:        VALIDATION_FAILED if AmountCents <= 0
Idempotent:    no
Notes:         The oldest-first allocation loop is naturally sequential (depends on remaining
                balance after each prior allocation) — already implemented as a plpgsql
                `FOR ... LOOP`, which is the correct, intentional implementation here, not a
                smell to optimise away into a single set-based statement.
```

---

## Communication

```
SP:            usp_Message_StartThread (real function: `public.start_thread`, exists)
Module:        communication
Kind:          write
Purpose:       Creates a thread, adds the creator and every named participant, and posts the
                first message — one operation, because the message-send authorization check
                requires the sender to already be a participant, so thread-creation and
                first-post cannot be split across two calls without a window where neither
                check holds.
Input params:  ThreadId:uuid:required, Subject:text:nullable,
                Body:text:required, CreatedBy:uuid:required,
                LearnerId:uuid:nullable, FirstMessageId:uuid:required,
                Participants:uuid[]:required (native array, not a TVP)
Result sets:   1) ThreadId uuid
Raises:        VALIDATION_FAILED if Body is blank after trim, FORBIDDEN if LearnerId is
                  supplied and the actor is not entitled to view that learner — with RLS kept
                  live (Phase 0 §1), this check is primarily RLS's job already; confirm during
                  the audit whether the existing function still needs its own explicit check or
                  whether it can rely entirely on the row-level policy now
Idempotent:    no

SP:            usp_Message_MarkThreadRead (real function: `public.mark_thread_read`, exists)
Module:        communication
Kind:          write
Purpose:       Marks every message in a thread not sent by the caller as read by the caller.
Input params:  ThreadId:uuid:required, ActorUserId:uuid:required
Result sets:   1) MarkedCount integer
Raises:        none (thread membership is enforced by RLS on the underlying tables, not a
                  separate pre-check call)
Idempotent:    yes (`INSERT ... WHERE NOT EXISTS` against the (MessageId, ProfileId) key —
                  already native Postgres, unchanged)
```

---

## CRUD SP index (straightforward — Row shape taken directly from the named migration file)

Every entry below follows the standard pattern from generic spec §9 (`getById` / `list` /
`create` / `update`, using `queryOne`/`queryMany`/`queryPaged`/`executeNonQuery` as fits) unless
a narrower set is noted. **"Actor-scoped" is now just a reading aid, not an implementation
instruction**: it flags which tables have a restrictive RLS policy in
`db/migrations/20261020000008_rls.sql` / `..._rls_phase2.sql` that will automatically narrow
what a given query returns, once the API's connection carries the actor's JWT claims per
`04-phase0...md` §1. No SP needs an `@ActorUserId`/`@ActorIsAdmin` parameter or its own
`WHERE`/`IF` visibility clause purely to reproduce what RLS already does — look up the policy
only to understand *what* gets filtered, not to re-implement it.

| Table (source migration) | SPs needed | Actor-scoped? |
|---|---|---|
| `school_phases`, `grades`, `subjects`, `subject_offerings`, `languages`, `achievement_levels`, `terms`, `centre_operating_hours`, `rooms` (`...002`) | `List` (public read) per table; `Create`/`Update` admin-only per table | No (public read); role-gated at controller for writes |
| `profiles`, `guardians` (`...003`, merges into `users`/`guardians` — see Phase 0) | `GetById`, `Update` (self or admin) | Yes |
| `user_roles` (`...003`) | `List` (self or admin), `Grant`, `Revoke` (admin only) | Yes |
| `learners` (`...003`) | `GetById` (full block above), `List` (admin: all; guardian: own; tutor: taught), `Update` (guardian/admin), `UpdateStatus` | Yes |
| `learner_guardians` (`...003`) | `List`, `Create`, `SetPrimary`, `SetBillingContact` | Yes |
| `learner_emergency_contacts`, `authorised_collectors` (`...003`) | `List`, `Create`, `Update`, `Delete` | Yes (guardian/admin only; tutors excluded) |
| `learner_medical_notes` (`...003`) | `Upsert` (full block above) | Yes (guardian/admin only; tutors excluded — see `03-endpoints-and-business-rules.md`) |
| `tutors` (`...003`) | `GetById`, `List` (public: active only; admin: all), `Update` (own profile or admin), `Create` (full block above) | Partial |
| `tutor_competencies`, `tutor_competency_media`, `tutor_spoken_languages` (`...003`) | `ListForTutor` (public read), `SetCompetency` (full block above), `SetSpokenLanguages` | No (public read) |
| `tutor_qualifications` (`...003`) | `List` (public read), `Create`/`Verify` (admin) | No (public read) |
| `tutor_documents`, `tutor_references` (`...003`) | `List` (full block above, admin-only), `Create`, `Verify`/`RecordOutcome` | Yes (admin only) |
| `tutor_pay_rates` (`...003`) | `ListForTutor` (own or admin), `SetPayRate` (full block above) | Yes |
| `packages`, `package_prices` (`...004`) | `List` (public: active only; admin: all), `Create`/`SetPrice` (admin), `GetPriceOn` (ported `package_price_on` function) | No (public read) |
| `billing_settings` (`...004`) | `GetEffectiveOn`, `Create` (admin only, no public read) | Yes (admin only) |
| `enrolments`, `enrolment_subjects` (`...005`) | `GetById` (actor-scoped: guardian/assigned tutor/admin), `List`, `Submit`/`Activate` (full blocks above) | Yes |
| `class_groups`, `class_group_grades`, `class_schedules` (`...006`) | `List` (public read for active groups), `Create`/`Update` (admin, calls `usp_ClassGroup_CheckTutorCompetent` first) | Partial |
| `class_sessions` (`...006`) | `GetPublicTimetable` (no `MeetingUrl` column — see Phase 0, "the v_public_timetable security boundary"), `ListForParticipant` (actor-scoped, includes `MeetingUrl`), `Create`, `UpdateStatus` | Partial |
| `class_enrolments` (`...006`) | `List` (actor-scoped), `Place` (full block above), `Withdraw` (sets `LeftOn`) | Yes |
| `attendance_records` (`...006`) | `List` (actor-scoped: `can_view_learner`), `Mark` (tutor who teaches the session, or admin), `Correct` | Yes |
| `session_check_ins` (`...006`) | `List` (actor-scoped), `Record` (full block above) | Yes |
| `consent_types` (`...007`) | `List` (public read), `Create` (admin) | No |
| `consents` (`...007`) | `List` (own-guardian or admin), `Record` (part of `usp_Enrolment_Submit`; standalone `Withdraw`) | Yes |
| `data_retention_policies`, `data_retention_log` (`...007`) | `List` (admin only), `GetDue` (ported `v_retention_due`), `RecordAction` (admin confirms) | Yes (admin only) |
| `programmes`, `programme_sessions` (`...009`) | `List` (public: published only; admin: all), `Create`/`Update` (admin) | Partial |
| `programme_enrolments` (`...009`) | `List` (actor-scoped), `Book` (must enforce capacity using the same `for update` lock pattern as the fixed `check_class_capacity` — **note: `check_programme_capacity` does NOT itself take a lock today; this is a real bug fix needed regardless of this API, see Phase 0 §4**), `Cancel` | Yes |
| `programme_attendance_records` (`...009`) | `List`, `Mark` | Yes |
| `assessment_types`, `assessment_domains` (`...010`) | `List` (public read) | No |
| `assessments`, `assessment_scores` (`...010`) | `List` (actor-scoped), `Record` (full block above) | Yes |
| `learning_plans`, `learning_plan_goals` (`...010`) | `List` (actor-scoped), `Create` (full block above), `UpdateGoalStatus` | Yes |
| `progress_reports`, `progress_report_subjects` (`...010`) | `List` (parent sees published only; tutor/admin see all), `Save` (full block above) | Yes |
| `report_acknowledgements` (`...010`) | `List`, `Acknowledge` (guardian only, rejects if report unpublished — port `check_ack_published`) | Yes |
| `billing_accounts` (`...011`) | `GetByGuardian` (actor-scoped), `GetOrCreate` (used internally by activation/billing-run SPs) | Yes |
| `invoices`, `invoice_lines` (`...011`) | `List`/`GetById` (actor-scoped — owner or admin), derived status via `usp_Invoice_GetStatus` (ports `v_invoice_status`) | Yes |
| `payments`, `payment_allocations` (`...011`) | `List` (actor-scoped), `Record` (full block above) | Yes |
| `credit_notes`, `credit_note_allocations` (`...011`) | `List` (actor-scoped), `Issue` (admin only) | Yes |
| `message_threads`, `thread_participants`, `messages`, `message_reads` (`...012`, `...021`) | `ListMine` (ports `v_my_threads`), `Start`/`MarkRead` (full blocks above), `Post` (append a message to an existing thread, same membership check), `AddParticipant` | Yes |
| `notifications`, `notification_recipients` (`...012`) | `ListMine` (actor-scoped), `Create`+`FanOutToRecipients` (admin only), `MarkRead` | Yes |
| `contact_enquiries` (`...012`) | `Submit` (public, no auth — anon insert), `List`/`UpdateStatus`/`Convert` (admin only) | Partial |
| `resources`, `resource_audiences` (`...012`) | `ListForActor` (replicates the four-way audience-type visibility check), `Create`/`Update` (owner tutor or admin) | Yes |
| `reviews` (`...012`) | `ListPublished` (public), `ListMine` (guardian), `Submit` (guardian, status forced to 'pending'), `Moderate` (admin) | Partial |
| `expense_categories`, `expenses` (`...013`) | `List`, `Create`/`Update` (admin only, no non-admin read at all) | Yes (admin only) |
| All `v_*` KPI/reporting views (`...013`, plus `v_invoice_status`, `v_account_statement`, `v_public_timetable`, `v_my_threads`, `tutor_rating_summary`) | These views already exist and already do the derivation work — no recreation needed (Phase 0 §5 voids the "views strategy" translation). One thin read-only wrapper function per view, named `usp_Report_<ViewName>` for this catalogue's cross-reference purposes, calling `SELECT * FROM <view> WHERE ...` — see `12-phase3f-finance-kpis-reporting.md` for the full list | Admin only, except `v_public_timetable` → public and `v_my_threads`/`tutor_rating_summary` → actor-scoped/public respectively |
