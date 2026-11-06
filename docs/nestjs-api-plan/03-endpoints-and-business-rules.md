# Sections 1.5 and 1.7 — Endpoints and Business Rules, per module

Fills generic spec §1.5 (endpoint tables) and §1.7 (business rules, caching, special cases).
SP names reference `02-sp-catalogue.md`. "Roles" blank = `@Public()`. Every endpoint not marked
public requires `JwtAuthGuard` (global) and, where Roles is non-blank, at least one matching
role via `RolesGuard` — row-level scoping beyond role is handled by the Manager/SP as described
in each module's business-rules list (ported from the matching RLS policy in
`db/migrations/20261020000008_rls.sql` / `..._rls_phase2.sql`).

---

## Module: `reference`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/reference/phases` | | `listPhases()` | `usp_SchoolPhase_List` | |
| 2 | GET | `/reference/grades` | | `listGrades()` | `usp_Grade_List` | |
| 3 | GET | `/reference/subjects` | | `listSubjects()` | `usp_Subject_List` | |
| 4 | GET | `/reference/subject-offerings` | | `listOfferings(gradeCode?)` | `usp_SubjectOffering_List` | |
| 5 | GET | `/reference/languages` | | `listLanguages()` | `usp_Language_List` | |
| 6 | GET | `/reference/achievement-levels` | | `listAchievementLevels()` | `usp_AchievementLevel_List` | |
| 7 | GET | `/reference/terms` | | `listTerms()` | `usp_Term_List` | |
| 8 | POST | `/reference/terms` | Admin | `createTerm(dto)` | `usp_Term_Create` | |
| 9 | GET | `/reference/operating-hours` | | `listOperatingHours()` | `usp_OperatingHours_List` | |
| 10 | GET | `/reference/rooms` | Admin | `listRooms()` | `usp_Room_List` | Not published publicly in the current app |
| 11 | POST | `/reference/rooms` | Admin | `createRoom(dto)` | `usp_Room_Create` | |

**Business rules**
- All lookups here are admin-write / public-read, matching migration `...002`'s "no write
  policy exists" comment — enforced both at the controller (`@Roles('Admin')` on every write)
  and by the existing RLS policy (kept live per Phase 0 §1), a real double-check this plan
  didn't have under the SQL-Server version.
- Terms: `StartsOn < EndsOn`, and no two terms for the same centre may overlap — already
  enforced by the existing `EXCLUDE USING GIST` constraint (native Postgres, unchanged; Phase 0
  §5 voids any "no-overlap ranges" translation work). No SP-level check-then-insert is needed.
- Achievement levels must tile 0–100 with no gaps/overlaps — same native-constraint situation
  as terms; nothing to add here either.
- Cacheable: every `list*` method here, key `skolopals:reference:<entity>`, TTL 1 hour (this
  data changes on an admin action, not continuously) — invalidate on the matching `create`/
  `update` call in the same Manager.

---

## Module: `people`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/people/me` | any | `getMyProfile(actor)` | `usp_User_GetById` | |
| 2 | PATCH | `/people/me` | any | `updateMyProfile(actor, dto)` | `usp_Profile_Update` | |
| 3 | GET | `/learners/:id` | any | `getLearnerById(id, actor)` | `usp_Learner_GetById` | 404 if not entitled (never 403 — see catalogue note) |
| 4 | GET | `/learners` | Admin, Tutor | `listLearners(actor, query)` | `usp_Learner_List` | Tutor sees only learners they teach |
| 5 | POST | `/learners` | Admin | `createLearner(dto)` | `usp_Learner_Create` | Walk-in path; normal path is `enrolment.submit` |
| 6 | PATCH | `/learners/:id` | Guardian-of, Admin | `updateLearner(id, actor, dto)` | `usp_Learner_Update` | |
| 7 | GET | `/learners/:id/guardians` | Guardian-of, Admin, teaching Tutor | `listGuardians(id, actor)` | `usp_LearnerGuardian_List` | |
| 8 | POST | `/learners/:id/guardians` | Guardian-of, Admin | `addGuardian(id, actor, dto)` | `usp_LearnerGuardian_Create` | |
| 9 | PATCH | `/learners/:id/guardians/:guardianId` | Guardian-of, Admin | `setContactFlags(dto)` | `usp_LearnerGuardian_SetPrimary` / `usp_LearnerGuardian_SetBillingContact` | At most one primary / one billing contact — DB-enforced filtered unique index |
| 10 | GET | `/learners/:id/emergency-contacts` | Guardian-of, Admin | `listEmergencyContacts(id, actor)` | `usp_EmergencyContact_List` | Never exposed to Tutor |
| 11 | POST | `/learners/:id/emergency-contacts` | Guardian-of, Admin | `addEmergencyContact(id, actor, dto)` | `usp_EmergencyContact_Create` | |
| 12 | DELETE | `/learners/:id/emergency-contacts/:contactId` | Guardian-of, Admin | `removeEmergencyContact(...)` | `usp_EmergencyContact_Delete` | 204 |
| 13 | GET | `/learners/:id/collectors` | Guardian-of, Admin | `listCollectors(id, actor)` | `usp_AuthorisedCollector_List` | Never exposed to Tutor |
| 14 | POST | `/learners/:id/collectors` | Guardian-of, Admin | `addCollector(id, actor, dto)` | `usp_AuthorisedCollector_Create` | |
| 15 | DELETE | `/learners/:id/collectors/:collectorId` | Guardian-of, Admin | `removeCollector(...)` | `usp_AuthorisedCollector_Delete` | 204 |
| 16 | GET | `/learners/:id/medical-notes` | Guardian-of, Admin | `getMedicalNotes(id, actor)` | `usp_LearnerMedicalNotes_GetById` | **Never** exposed to Tutor, including indirectly — do not add a Manager method any Tutor-reachable controller can call |
| 17 | PUT | `/learners/:id/medical-notes` | Guardian-of, Admin | `upsertMedicalNotes(id, actor, dto)` | `usp_LearnerMedicalNotes_Upsert` | |

**Business rules**
- "Can view learner" = guardian of that learner, the learner themself (if they have a login),
  a tutor currently teaching them, or admin. Ported from `private.can_view_learner`; every
  Manager method above that takes `actor` implements this exact check before calling its
  repository, by querying `learner_guardians`, `learners.profile_id`, and
  `class_enrolments ⋈ class_groups` respectively — do not shortcut this to a role check alone.
- "Can view learner — private" (billing/safeguarding tier) = guardian or admin **only**, tutor
  explicitly excluded. Applies to guardians list, emergency contacts, collectors, and medical
  notes. This is the POPIA boundary (policy Annex A4/A6) — a bug here is a compliance incident,
  not just a logic error; cover it with a dedicated Manager-unit-test per generic spec §10 that
  asserts a Tutor actor is rejected even when they do teach the learner.
- At most one `is_primary` and one `is_billing_contact` guardian per learner — DB-enforced
  (filtered unique index), Manager surfaces the resulting 409 as-is.
- A learner's `status` and `left_on` move together (`left_on` set iff status = 'left') —
  checked in `usp_Learner_Update`, port of the Postgres CHECK constraint.
- Cacheable: none (all learner data is per-actor-scoped and changes with enrolment/attendance
  activity — caching it risks leaking across actors if the key is ever built wrong; not worth
  the risk for a low-traffic admin/parent portal).

---

## Module: `tutors`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/tutors` | | `listPublic(query)` | `usp_Tutor_List` (public: active only) | Public directory |
| 2 | GET | `/tutors/:slug` | | `getBySlug(slug)` | `usp_Tutor_GetBySlug` | Public profile + `tutor_rating_summary` |
| 3 | GET | `/tutors/me` | Tutor | `getMyProfile(actor)` | `usp_Tutor_GetById` | |
| 4 | PATCH | `/tutors/me` | Tutor | `updateMyProfile(actor, dto)` | `usp_Tutor_Update` | Own profile only |
| 5 | POST | `/tutors` | Admin | `create(dto)` | `usp_Tutor_Create` | BR-23: existing account only |
| 6 | GET | `/tutors/:id/competencies` | | `listCompetencies(id)` | `usp_TutorCompetency_List` | Public (staff directory) |
| 7 | PUT | `/tutors/:id/competencies` | Admin | `setCompetency(id, dto)` | `usp_Tutor_SetCompetency` | |
| 8 | PUT | `/tutors/:id/spoken-languages` | Admin | `setSpokenLanguages(id, dto)` | `usp_TutorSpokenLanguage_Set` | |
| 9 | GET | `/tutors/:id/qualifications` | | `listQualifications(id)` | `usp_TutorQualification_List` | Public |
| 10 | POST | `/tutors/:id/qualifications` | Admin | `addQualification(id, dto)` | `usp_TutorQualification_Create` | |
| 11 | GET | `/tutors/:id/documents` | Admin | `listDocuments(id)` | `usp_TutorDocument_List` | Vetting material — admin only |
| 12 | POST | `/tutors/:id/documents` | Admin | `uploadDocument(id, file, dto)` | `usp_TutorDocument_Create` | Multipart; see Phase 0 file-storage design |
| 13 | GET | `/tutors/:id/references` | Admin | `listReferences(id)` | `usp_TutorReference_List` | |
| 14 | POST | `/tutors/:id/references` | Admin | `addReference(id, dto)` | `usp_TutorReference_Create` | |
| 15 | PATCH | `/tutors/:id/references/:refId` | Admin | `recordOutcome(...)` | `usp_TutorReference_RecordOutcome` | |
| 16 | GET | `/tutors/:id/pay-rates` | Tutor (own), Admin | `listPayRates(id, actor)` | `usp_TutorPayRate_ListForTutor` | |
| 17 | PUT | `/tutors/:id/pay-rates` | Admin | `setPayRate(id, dto)` | `usp_Tutor_SetPayRate` | |

**Business rules**
- A tutor is created only for an existing account — `usp_Tutor_Create` raises NOT_FOUND ("ask them
  to sign up first") rather than the Manager silently creating one; this mirrors BR-23 and the
  "no public tutor application" decision exactly.
- Competency upsert requires ≥1 language of instruction — VALIDATION_FAILED otherwise (ported check).
- Pay rate periods never overlap for a tutor — enforced by closing the open rate before
  inserting the new one, inside one transaction (see catalogue note on `usp_Tutor_SetPayRate`).
- Vetting documents and reference checks are admin-only in both directions — no Tutor or
  Guardian path reaches these Manager methods at all, matching POPIA policy Annex B5.
- Cacheable: `listPublic`, `getBySlug`, `listCompetencies`, `listQualifications` — 5 minute TTL,
  invalidated on `create`/`update`/`setCompetency`/`addQualification` for that tutor. Key format
  `skolopals:tutors:bySlug:<slug>` etc.

---

## Module: `packages`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/packages` | | `listActive()` | `usp_Package_List` (public: active only) | Pricing page |
| 2 | GET | `/packages/:code/price` | | `getPriceOn(code, on?)` | `usp_PackagePrice_GetOn` | Ports `package_price_on` |
| 3 | GET | `/packages` (admin) | Admin | `listAll()` | `usp_Package_List` (admin variant) | Same path, different query param gates admin fields — or split to `/admin/packages`; decide at Phase 3b, note both options here |
| 4 | POST | `/packages` | Admin | `create(dto)` | `usp_Package_Create` | |
| 5 | POST | `/packages/:code/prices` | Admin | `setPrice(code, dto)` | `usp_PackagePrice_Create` | No two prices on the same day — overlap guard, same pattern as pay rates |
| 6 | GET | `/billing-settings/current` | Admin | `getCurrent()` | `usp_BillingSettings_GetEffectiveOn` | No public read — internal only |
| 7 | POST | `/billing-settings` | Admin | `create(dto)` | `usp_BillingSettings_Create` | |

**Business rules**
- Package prices are temporal and never overlap for the same package — overlap guard per
  Phase 0's "no-overlap ranges" pattern.
- `BillingSettings` likewise temporal and non-overlapping; no two settings rows in effect for
  the same date. Current values per the business plan: `IssueDay=15`, `DueDay=1`, `GraceDays=3`,
  `LateFeeCents=15000` — seeded once in Phase 0's local stubs, entered for real by the owner in
  production.
- Cacheable: `listActive`, `getPriceOn` — 5 minute TTL, invalidated on `create`/`setPrice`.

---

## Module: `enrolment`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | POST | `/enrolments` | Parent | `submit(actor, dto)` | `usp_Enrolment_Submit` | The guardian-facing enrolment form |
| 2 | GET | `/enrolments/:id` | Guardian-of-learner, assigned Tutor, Admin | `getById(id, actor)` | `usp_Enrolment_GetById` | |
| 3 | GET | `/enrolments` | Admin | `list(query)` | `usp_Enrolment_List` | Admin queue, filterable by status |
| 4 | POST | `/enrolments/:id/activate` | Admin | `activate(id, dto)` | `usp_Enrolment_Activate`, `usp_Invoice_NextNumber` | |
| 5 | POST | `/enrolments/:id/decline` | Admin | `decline(id, dto)` | `usp_Enrolment_UpdateStatus` | Sets status 'declined' |
| 6 | PATCH | `/enrolments/:id/subjects` | Admin | `updateSubjects(id, dto)` | `usp_EnrolmentSubject_Set` | Subject count ≤ package allowance |

**Business rules**
- Subject selection count must not exceed `Packages.SubjectAllowance` (null = unlimited) —
  already enforced by the existing deferred constraint trigger (native Postgres, unchanged;
  Phase 0 §5 voids any "deferred constraint trigger" translation work).
- An enrolment cannot be activated unless: (a) the learner has a billing contact, (b) every
  `ConsentTypes.IsRequired` consent is granted and not withdrawn for that learner (POPIA s35) —
  both checked inside `usp_Enrolment_Activate`, raising BUSINESS_RULE_VIOLATION. These are **the** two rules that
  must never regress; cover both with a dedicated Manager unit test per rule, per generic spec
  §10.
- Registration fee is charged exactly once per **learner**, not per enrolment — checked by
  existence-of-a-prior-registration-line-for-this-learner inside `usp_Enrolment_Activate`.
- `preferred_tutor_id` (what the parent asked for) and `assigned_tutor_id` (what the centre
  decided) are stored separately and never conflated — a reassignment must not silently
  overwrite the original request.
- Cacheable: none (workflow data, low volume, changes on every admin action).

---

## Module: `timetable`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/timetable/public` | | `getPublicTimetable()` | `usp_ClassSession_GetPublicTimetable` | No `MeetingUrl` — see Phase 0 security-boundary note |
| 2 | GET | `/class-groups` | | `listActive(query)` | `usp_ClassGroup_List` | Public: active only |
| 3 | GET | `/class-groups/:id` | | `getById(id)` | `usp_ClassGroup_GetById` | |
| 4 | POST | `/class-groups` | Admin | `create(dto)` | `usp_ClassGroup_CheckTutorCompetent` then `usp_ClassGroup_Create` | |
| 5 | PATCH | `/class-groups/:id` | Admin | `update(id, dto)` | `usp_ClassGroup_CheckTutorCompetent` then `usp_ClassGroup_Update` | |
| 6 | POST | `/class-groups/:id/schedules` | Admin | `addSchedule(id, dto)` | `usp_ClassSchedule_Create` | Rejects a time outside centre operating hours for in-centre classes |
| 7 | DELETE | `/class-groups/:id/schedules/:scheduleId` | Admin | `removeSchedule(...)` | `usp_ClassSchedule_Delete` | 204 |
| 8 | POST | `/class-groups/:id/generate-sessions` | Admin | `generateSessions(id)` | `usp_ClassGroup_GenerateSessions` | Idempotent |
| 9 | GET | `/class-sessions` | Tutor (own/taught), Guardian (enrolled), Admin | `listForParticipant(actor, query)` | `usp_ClassSession_ListForParticipant` | Includes `MeetingUrl` |
| 10 | PATCH | `/class-sessions/:id` | Admin, teaching Tutor | `updateStatus(id, dto)` | `usp_ClassSession_UpdateStatus` | held/cancelled + notes |
| 11 | GET | `/class-groups/:id/enrolments` | Admin, teaching Tutor | `listPlacements(id, actor)` | `usp_ClassEnrolment_List` | |
| 12 | POST | `/class-groups/:id/enrolments` | Admin | `place(id, dto)` | `usp_ClassEnrolment_Place` | Capacity-checked under lock |
| 13 | POST | `/class-groups/:id/enrolments/:enrolmentId/withdraw` | Admin | `withdraw(...)` | `usp_ClassEnrolment_Withdraw` | Sets `LeftOn` |

**Business rules**
- A class group's assigned tutor must be a recorded competency match (subject, every grade on
  the class, and the class's medium of instruction) — checked by the Manager calling
  `usp_ClassGroup_CheckTutorCompetent` **before** create/update, not after (see catalogue note:
  this moves from an after-the-fact deferred trigger to a pre-check, which is strictly safer).
- A class held in-centre must fall inside `centre_operating_hours` for `purpose='tutoring'`;
  online classes are exempt. Checked in `usp_ClassSchedule_Create`.
- A learner occupies at most one active (`LeftOn IS NULL`) placement per class group — DB
  filtered unique index — and placement must not exceed `ClassGroups.Capacity`, already
  enforced under `for update` exactly as described in the catalogue (this is the capacity-race
  fix project memory already flagged as the one bug that was found and fixed — re-confirm this
  still holds when called through the API's new connection pattern, per Phase 0 §6's
  concurrency-test requirement; this is the highest-scrutiny item in the whole plan).
- `/timetable/public` deliberately omits `MeetingUrl` — a separate, narrower view/SP and
  Manager method from the participant-facing one, not a column filter applied after the fact in
  the controller. The existing `v_public_timetable` view's column list already is the security
  boundary (native Postgres, unchanged; Phase 0 §5) — the API just needs to keep querying it
  specifically for this endpoint, not the wider view.
- Cacheable: `/timetable/public`, `listActive`, `getById` — 5 minute TTL (the public timetable
  is read constantly and changes rarely); invalidate on any admin write to the touched class
  group.

---

## Module: `attendance`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/class-sessions/:id/attendance` | Guardian (of enrolled learner), teaching Tutor, Admin | `list(sessionId, actor)` | `usp_AttendanceRecord_List` | |
| 2 | POST | `/class-sessions/:id/attendance` | teaching Tutor, Admin | `mark(sessionId, actor, dto)` | `usp_AttendanceRecord_Mark` | Only the session's tutor (or substitute) or admin |
| 3 | PATCH | `/class-sessions/:id/attendance/:recordId` | teaching Tutor, Admin | `correct(...)` | `usp_AttendanceRecord_Correct` | |
| 4 | GET | `/class-sessions/:id/check-ins` | Guardian-of (private tier), teaching Tutor, Admin | `listCheckIns(sessionId, actor)` | `usp_SessionCheckIn_List` | |
| 5 | POST | `/class-sessions/:id/check-ins` | Admin | `signIn(sessionId, dto)` | `usp_SessionCheckIn_Record` | Front-desk function per BP §22 |
| 6 | PATCH | `/class-sessions/:id/check-ins/:checkInId` | Admin | `signOut(...)` | `usp_SessionCheckIn_Record` | Sets `DepartedAt`/`CollectedBy`; rejects an unauthorised collector |

**Business rules**
- Attendance may only be marked by the session's own tutor (`ClassSessions.TutorId`, falling
  back to `ClassGroups.TutorId` if null — "substitute for this occurrence only") or an admin.
- A collector may sign a learner out only if they are on that learner's active authorised-
  collector list as of the departure date — BUSINESS_RULE_VIOLATION otherwise. Never bypass this for convenience;
  it is the one safeguarding control the whole attendance module exists to enforce (BP §22).
- Cacheable: none (operational, changes constantly during contact hours).

---

## Module: `programmes`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/programmes` | | `listPublished()` | `usp_Programme_List` (public: published only) | |
| 2 | GET | `/programmes/:id` | | `getById(id)` | `usp_Programme_GetById` | |
| 3 | POST | `/programmes` | Admin | `create(dto)` | `usp_Programme_Create` | |
| 4 | PATCH | `/programmes/:id` | Admin | `update(id, dto)` | `usp_Programme_Update` | Includes publish toggle |
| 5 | POST | `/programmes/:id/sessions` | Admin | `addSession(id, dto)` | `usp_ProgrammeSession_Create` | |
| 6 | GET | `/programmes/:id/sessions` | Tutor (own), Guardian (booked learner), Admin | `listSessions(id, actor)` | `usp_ProgrammeSession_List` | |
| 7 | GET | `/programmes/:id/enrolments` | Guardian (own), Admin | `listBookings(id, actor)` | `usp_ProgrammeEnrolment_List` | |
| 8 | POST | `/programmes/:id/enrolments` | Parent | `book(id, actor, dto)` | `usp_ProgrammeEnrolment_Book` | Capacity-checked under lock |
| 9 | POST | `/programmes/:id/enrolments/:enrolmentId/cancel` | Guardian-of, Admin | `cancel(...)` | `usp_ProgrammeEnrolment_Cancel` | |
| 10 | GET | `/programme-sessions/:id/attendance` | teaching Tutor, Admin, Guardian-of | `list(sessionId, actor)` | `usp_ProgrammeAttendance_List` | |
| 11 | POST | `/programme-sessions/:id/attendance` | teaching Tutor, Admin | `mark(sessionId, actor, dto)` | `usp_ProgrammeAttendance_Mark` | |

**Business rules**
- Same one-on-one-tuition-is-capacity-1 mechanism and overlap-safe capacity guard as class
  enrolment placement — `usp_ProgrammeEnrolment_Book` must use the identical `for update`
  pattern as the fixed `usp_ClassEnrolment_Place`; do not let these two drift into different
  locking approaches. **This is a real, currently-missing fix, not already-done work**: unlike
  `check_class_capacity`, the current `check_programme_capacity` trigger does not itself lock
  the row before counting (verified against `db/migrations/20261020000009_programmes.sql` — no
  `FOR UPDATE` present), so it carries the same latent race condition the class-placement
  trigger had before it was fixed. Apply the fix migration from Phase 0 §4 before relying on
  this endpoint under real concurrency.
- An in-centre programme must have a room; online is exempt — same CHECK as class groups.
- Cacheable: `listPublished`, `getById` — 5 minute TTL, invalidated on `create`/`update`.

---

## Module: `assessment`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/reference/assessment-types` | | `listTypes()` | `usp_AssessmentType_List` | Public |
| 2 | GET | `/reference/assessment-domains` | | `listDomains()` | `usp_AssessmentDomain_List` | Public |
| 3 | GET | `/learners/:id/assessments` | can-view-learner | `list(learnerId, actor)` | `usp_Assessment_List` | |
| 4 | POST | `/learners/:id/assessments` | teaching Tutor, Admin | `record(learnerId, actor, dto)` | `usp_Assessment_Record` | |
| 5 | GET | `/learners/:id/learning-plans` | can-view-learner | `list(learnerId, actor)` | `usp_LearningPlan_List` | |
| 6 | POST | `/learners/:id/learning-plans` | teaching Tutor, Admin | `create(learnerId, actor, dto)` | `usp_LearningPlan_Create` | Supersedes the current active plan |
| 7 | PATCH | `/learning-plans/:id/goals/:goalId` | teaching Tutor, Admin | `updateGoalStatus(...)` | `usp_LearningPlanGoal_UpdateStatus` | |

**Business rules**
- "Teaching tutor" = `private.tutor_teaches` ported check: the actor's `TutorId` has an active
  `class_enrolments` row for that learner right now. Admin bypasses this; no one else may write
  an assessment, score, or plan.
- An assessment must carry ≥1 domain score — BUSINESS_RULE_VIOLATION otherwise (no scoreless assessments).
- Achievement level per score is derived from the percentage band, not chosen freely — see
  catalogue note on `usp_Assessment_Record`.
- A learner has at most one `active` learning plan; creating a new one supersedes the old one
  in the same transaction (filtered unique index backs this; the SP does the supersede-then-
  create itself so there's never a window with zero or two active plans).
- Cacheable: none (small per-learner volumes, must always be current for a tutor mid-session).

---

## Module: `progress-reports`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/learners/:id/progress-reports` | Guardian-of (published only), teaching Tutor (incl. drafts), Admin | `list(learnerId, actor)` | `usp_ProgressReport_List` | |
| 2 | GET | `/progress-reports/:id` | same as above | `getById(id, actor)` | `usp_ProgressReport_GetById` | |
| 3 | PUT | `/learners/:id/progress-reports/:termId` | teaching Tutor, Admin | `save(learnerId, termId, actor, dto)` | `usp_ProgressReport_Save` | Upsert; `publish` flag |
| 4 | POST | `/progress-reports/:id/acknowledge` | Guardian-of | `acknowledge(id, actor, dto)` | `usp_ReportAcknowledgement_Create` | Rejects if unpublished |

**Business rules**
- A parent sees a report only once `PublishedAt` is set; a draft is the tutor's working copy —
  the SAME endpoint (`list`/`getById`) returns different rows depending on actor role, it is
  **not** two separate endpoints, matching how the Postgres RLS policy reads (`published_at is
  not null and can_view_learner(...)) or tutor_teaches(...) or is_admin()`).
- Publishing is one-way: a published report is never silently unpublished by a later `save`
  call with `publish=false` — `PublishedAt` only ever moves from null to a value, never back.
- A report cannot be published with zero subject rows; an acknowledgement cannot be created for
  an unpublished report. Both BUSINESS_RULE_VIOLATION from the SP, not pre-validated redundantly in the Manager.
- Cacheable: none.

---

## Module: `billing`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/billing-accounts/me` | Parent | `getMine(actor)` | `usp_BillingAccount_GetByGuardian` | |
| 2 | GET | `/billing-accounts/:id` | owner Guardian, Admin | `getById(id, actor)` | `usp_BillingAccount_GetById` | |
| 3 | GET | `/billing-accounts/:id/statement` | owner Guardian, Admin | `getStatement(id, actor)` | `usp_Report_AccountStatement` | Ports `v_account_statement` |
| 4 | GET | `/invoices/:id` | owner Guardian, Admin | `getById(id, actor)` | `usp_Invoice_GetById`, `usp_Invoice_GetStatus` | Ports `v_invoice_status` for derived payment state |
| 5 | GET | `/billing-accounts/:id/invoices` | owner Guardian, Admin | `listInvoices(id, actor)` | `usp_Invoice_List` | |
| 6 | POST | `/billing/run-monthly-invoices` | Admin | `runMonthly(dto)` | `usp_Billing_RunMonthlyInvoices` | |
| 7 | POST | `/billing/apply-late-fees` | Admin | `applyLateFees(dto)` | `usp_Billing_ApplyLateFees` | |
| 8 | POST | `/billing-accounts/:id/payments` | Admin | `recordPayment(id, dto)` | `usp_Billing_RecordPayment` | |
| 9 | GET | `/billing-accounts/:id/payments` | owner Guardian, Admin | `listPayments(id, actor)` | `usp_Payment_List` | |
| 10 | POST | `/billing-accounts/:id/credit-notes` | Admin | `issueCreditNote(id, dto)` | `usp_CreditNote_Issue` | |
| 11 | GET | `/admin/billing/outstanding` | Admin | `getOutstanding()` | `usp_Report_OutstandingFees` | Ports `v_outstanding_fees` |

**Business rules**
- Invoice numbers (`SKP-YYYY-NNNN`) are allocated under a row lock and never reused — see
  `usp_Invoice_NextNumber`. Resets each January (per-year sequence row).
- `Invoices.Status` holds workflow state only ('draft'/'issued'/'cancelled'/'written_off').
  Paid/part-paid/overdue is **always derived** from allocations via `usp_Invoice_GetStatus`,
  never stored — do not add a cached "is it paid" column anywhere; the whole point of the
  Postgres design this ports is that a stored payment status drifts the moment a payment is
  corrected.
- A payment cannot be allocated beyond its own value; an invoice cannot be settled (payments +
  credits) beyond its line total. Both checked as an end-of-batch validation inside the writing
  SP after all allocation rows are written, replacing Postgres's deferred constraint triggers.
- Payments allocate oldest-due-first automatically; any remainder is left unallocated as a
  running credit, picked up by the next allocation pass.
- Late fees attach to the next invoice the account receives, not retroactively onto the overdue
  one — an issued invoice's total never changes after it is sent.
- One package line per enrolment per billed month, ever; one late-fee line per overdue invoice,
  ever — both backed by filtered unique indexes, which is what actually makes
  `usp_Billing_RunMonthlyInvoices`/`usp_Billing_ApplyLateFees` safe to re-run (idempotent by
  construction, not by a fragile check-then-skip).
- Tutors have zero access to this entire module — no endpoint here ever accepts `Tutor` in
  `Roles`, by design (BP: tutors are salaried/per-session staff, not revenue-share partners).
- Cacheable: none (financial data must always be current; a stale balance is a support ticket).

---

## Module: `communication`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/threads` | any | `listMine(actor)` | `usp_MessageThread_ListMine` | Ports `v_my_threads` |
| 2 | POST | `/threads` | any | `start(actor, dto)` | `usp_Message_StartThread` | |
| 3 | GET | `/threads/:id/messages` | participant, Admin | `listMessages(id, actor)` | `usp_Message_List` | |
| 4 | POST | `/threads/:id/messages` | participant | `post(id, actor, dto)` | `usp_Message_Create` | |
| 5 | POST | `/threads/:id/read` | participant | `markRead(id, actor)` | `usp_Message_MarkThreadRead` | |
| 6 | POST | `/threads/:id/participants` | participant, Admin | `addParticipant(id, actor, dto)` | `usp_ThreadParticipant_Create` | |
| 7 | GET | `/notifications` | any | `listMine(actor)` | `usp_Notification_ListMine` | |
| 8 | POST | `/notifications` | Admin | `create(dto)` | `usp_Notification_Create` + fan-out | Broadcast or targeted list of recipients |
| 9 | PATCH | `/notifications/:id/read` | recipient | `markRead(id, actor)` | `usp_NotificationRecipient_MarkRead` | |

**Business rules**
- You may only send a message into a thread you already participate in; you may only open a
  thread about a learner you are entitled to view (`can_view_learner`).
- Messages and read receipts are append-only: no update path exists for `messages`,
  `report_acknowledgements`, or `thread_participants` membership rows — editing history is not
  a feature here, by design.
- Cacheable: none (needs to be live).

---

## Module: `enquiries`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | POST | `/enquiries` | | `submit(dto)` | `usp_ContactEnquiry_Create` | Public contact form — anon, rate-limited harder than default |
| 2 | GET | `/enquiries` | Admin | `list(query)` | `usp_ContactEnquiry_List` | |
| 3 | PATCH | `/enquiries/:id` | Admin | `updateStatus(id, dto)` | `usp_ContactEnquiry_UpdateStatus` | |
| 4 | POST | `/enquiries/:id/convert` | Admin | `convert(id, dto)` | `usp_ContactEnquiry_Convert` | Links to the resulting learner once enrolled |

**Business rules**
- Anyone may submit; only admins may ever read the list. A fresh submission must have
  `status='new'`, `handled_by` and `converted_learner_id` both null — enforced in
  `usp_ContactEnquiry_Create`, not trusted to the client.
- Cacheable: none.

---

## Module: `resources`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/resources` | any | `listForActor(actor)` | `usp_Resource_ListForActor` | Four-way audience check |
| 2 | POST | `/resources` | Tutor, Admin | `create(actor, dto)` | `usp_Resource_Create`, `usp_ResourceAudience_Create` | |
| 3 | PATCH | `/resources/:id` | owning Tutor, Admin | `update(id, actor, dto)` | `usp_Resource_Update` | |
| 4 | DELETE | `/resources/:id/audiences/:audienceId` | owning Tutor, Admin | `removeAudience(...)` | `usp_ResourceAudience_Delete` | 204 |

**Business rules**
- Audience is exactly one of `learner` / `class_group` / `grade` / `all`, with exactly the
  matching column populated — ported CHECK constraint, re-validated in the Manager DTO (a
  class-validator custom validator keyed on `audienceType`, per generic spec §7.2).
- `listForActor` visibility: owner, admin, or anyone matched by at least one audience row
  (`all`, the actor's own learner(s) if `learner`-typed, the actor's learner's grade if
  `grade`-typed, or the actor's learner's active class placement if `class_group`-typed).
- Cacheable: none (targeting is per-actor).

---

## Module: `reviews`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/tutors/:id/reviews` | | `listPublished(tutorId)` | `usp_Review_ListPublished` | |
| 2 | GET | `/reviews/mine` | Parent | `listMine(actor)` | `usp_Review_ListMine` | |
| 3 | POST | `/tutors/:id/reviews` | Parent | `submit(tutorId, actor, dto)` | `usp_Review_Create` | Status forced to 'pending' |
| 4 | PATCH | `/reviews/:id/moderate` | Admin | `moderate(id, dto)` | `usp_Review_Moderate` | publish/reject |

**Business rules**
- A guardian may review a tutor at most once per (tutor, guardian, learner) combination — DB
  unique constraint.
- Rating is **always derived** from published reviews (`tutor_rating_summary`), never a stored
  column maintained by a trigger — do not reintroduce `tutors.rating`/`review_count` columns;
  that was the exact anti-pattern the Postgres rebuild removed.
- Cacheable: `listPublished` per tutor, 5 minute TTL, invalidated on `moderate`.

---

## Module: `consent`

| # | Method | Path | Roles | Manager method | SP(s) | Notes |
|---|---|---|---|---|---|---|
| 1 | GET | `/reference/consent-types` | | `list()` | `usp_ConsentType_List` | Public — enrolment form renders these |
| 2 | GET | `/learners/:id/consents` | Guardian-of, Admin | `list(learnerId, actor)` | `usp_Consent_List` | |
| 3 | POST | `/learners/:id/consents/:consentTypeCode/withdraw` | Guardian-who-granted | `withdraw(...)` | `usp_Consent_Withdraw` | |
| 4 | GET | `/admin/retention/due` | Admin | `getDue()` | `usp_Report_RetentionDue` | Ports `v_retention_due` |
| 5 | POST | `/admin/retention/:learnerId/action` | Admin | `recordAction(learnerId, dto)` | `usp_DataRetentionLog_Create` | Deletion/anonymisation always requires this confirmation step — never a silent purge |

**Business rules**
- Required consents (`ConsentTypes.IsRequired=1`) block enrolment activation; optional ones
  must default to **off** and must never block submission — bundling them would invalidate the
  consent under POPIA s35. This is enforced at the DTO level (optional consent fields default
  `false`, not `true`) as well as in the SP.
- One **live** consent per (type, guardian, learner) — withdrawn rows are kept as the record of
  withdrawal, not deleted; a withdrawal is an insert-new-withdrawn-marker or an update of
  `WithdrawnAt`, never a DELETE.
- Nothing in the retention workflow deletes data without an admin-confirmed
  `usp_DataRetentionLog_Create` call first — the "due" report is read-only and informational.
- Cacheable: `usp_ConsentType_List` only (public, slow-moving) — 1 hour TTL.

---

## Module: `finance`

See `12-phase3f-finance-kpis-reporting.md` for the full endpoint table (one read-only endpoint
per KPI view) and business rules (all admin-only, all read-only, all deriving from other
modules' data rather than owning any write path of their own).
