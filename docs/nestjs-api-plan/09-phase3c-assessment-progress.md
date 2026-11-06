# Phase 3c — Assessment & Progress

Depends on Phase 3a (`tutor_teaches`/`can_view_learner`) and Phase 3b (`terms`, enrolment —
assessments optionally reference a term). Build order: **`assessment` → `progress-reports`**
(progress reports don't strictly depend on assessments, but both share the "teaching tutor"
authorization shape, so building assessment first gives progress-reports a working template).

## Modules, endpoints, business rules, SPs

Fully specified in `03-endpoints-and-business-rules.md` (§`assessment`, §`progress-reports`)
and `02-sp-catalogue.md` (same headers).

## Tasks specific to this slice

1. `assessment`: `usp_Assessment_Record`'s achievement-level-from-percentage banding is already
   computed inside the existing function (per the catalogue note), joining `AchievementLevels` —
   write a Repository-level test asserting the exact banding for a handful of known percentages
   against the real achievement-level table, not just a Manager-level mock that assumes the
   function does the right thing.
2. `assessment`: `usp_LearningPlan_Create`'s "supersede then create" is already one statement
   batch inside one transaction in the existing function — confirm this during the Phase 0 §6
   audit, then test that a crash/rollback between the two leaves the learner's prior plan still
   active (not superseded with nothing to replace it). This is the same "all-or-nothing" shape
   as `usp_Enrolment_Submit`, smaller in scope.
3. `progress-reports`: the single endpoint that returns **different rows for different
   actors** (`list`/`getById` — draft visible to the tutor/admin, hidden from the parent until
   published) is worth a dedicated e2e test matrix (tutor sees draft; parent gets empty/404 for
   the same report id; parent sees it once published) rather than inferring it from the Manager
   unit tests alone. This behaviour is RLS's job here (kept live per Phase 0 §1) rather than
   something the API has to reimplement — the test matrix exists to prove RLS is actually doing
   it through the new connection pattern, not to cover for a missing backstop the way it would
   have under the SQL Server plan.

## Verify

- `pnpm lint && pnpm test && pnpm test:e2e` pass for both modules.
- Every endpoint in both endpoint tables exists with the specified shape; Swagger complete.
- The actor-matrix e2e test from task 3 passes for all three actor types (tutor/parent/admin)
  against both draft and published states.
- Manager tests cover: non-teaching tutor rejected on write for both modules; scoreless
  assessment rejected; goalless plan rejected; subjectless report rejected from publishing;
  unpublished-report acknowledgement rejected.
