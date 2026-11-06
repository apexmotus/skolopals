# Phase 3e — Communication, Enquiries, Resources, Reviews, Consent/Retention

Depends on Phase 3a (`can_view_learner`, guardians) and, for `resources`' class-group audience
type, Phase 3b (`class_enrolments`). These five modules have no downstream dependents — they
can be reprioritised relative to `finance` (3f) if the owner wants KPI reporting sooner, but
not relative to 3a/3b. Build order within this slice is not load-bearing; suggested:
**`consent` → `enquiries` → `communication` → `resources` → `reviews`** (consent first because
`enrolment`, already built in 3b, technically needs `ConsentTypes` seeded and the withdraw
endpoint to be a complete feature, not just the read path it already has).

## Modules, endpoints, business rules, SPs

Fully specified in `03-endpoints-and-business-rules.md` (§`communication`, §`enquiries`,
§`resources`, §`reviews`, §`consent`) and `02-sp-catalogue.md` (`usp_Message_StartThread`,
`usp_Message_MarkThreadRead` full blocks; everything else in the CRUD index).

## Tasks specific to this slice

1. `consent`: build `usp_Consent_Withdraw` as an insert-new-withdrawn-marker or
   `WithdrawnAt`-update — **never** a `DELETE`, per Phase 0/business-rules: a withdrawn consent
   is kept as the record that it was withdrawn. Confirm the retention module's
   `usp_DataRetentionLog_Create` is the only write path that can ever remove/anonymise a
   learner record, and that no other module's code path calls `DELETE` on `Learners` — generic
   spec's own layer rules forbid business logic in the repository, but this is worth a specific
   grep-level check during review given how much POPIA weight sits on this one guarantee.
2. `communication`: `usp_Message_StartThread`'s participant-must-already-exist-before-posting
   ordering (thread → participants → first message, one transaction) is the one place in this
   slice with real atomicity risk; everything else here is simple CRUD.
3. `resources`: implement the four-way audience check (`all`/`learner`/`grade`/`class_group`)
   as a single `usp_Resource_ListForActor` read, not four separate queries unioned in the
   Manager — matching how the ported RLS policy expressed it as one `OR`-chain, and keeping the
   visibility logic in one place for the next person to audit.
4. `reviews`: confirm `tutor_rating_summary` stays a live-computed read (`usp_Report_
   TutorRatingSummary`, called from both `tutors` module's public profile endpoint and here) —
   do not let a `rating`/`review_count` column creep onto the `Tutors` table during
   implementation; that's the specific anti-pattern the Postgres rebuild already removed once
   (see the ported view's comment), and it's an easy "optimisation" for someone to reach for
   without realising it reintroduces a drift bug.

## Verify

- `pnpm lint && pnpm test && pnpm test:e2e` pass for all five modules.
- Every endpoint across the five endpoint tables exists with the specified shape; Swagger
  complete.
- Manager tests cover: optional consents default to not-blocking; append-only tables
  (`messages`, `report_acknowledgements`, `thread_participants`) have no update endpoint at
  all (test this as an absence — the controller must not expose a PATCH/PUT route, not merely
  "the Manager rejects it"); resource audience visibility for each of the four audience types;
  one-review-per-(tutor,guardian,learner) uniqueness.
