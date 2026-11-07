-- "consents: guardian own or admin"'s SELECT policy only checked
-- `guardian_id = auth.uid()` -- that a guardian is reading a consent row they
-- personally granted -- not that they are a co-guardian of the same learner.
-- The API plan's endpoint table ("GET /learners/:id/consents") lists the
-- role as "Guardian-of, Admin", not "the exact granting guardian" (that
-- narrower rule is reserved for endpoint #3, "withdraw", whose role really
-- is "Guardian-who-granted" -- the existing UPDATE policy is correct as-is).
-- A learner with two guardians (e.g. both parents) would otherwise have one
-- parent's consent grants invisible to the other, even though both are
-- entitled to see the full consent record for their shared child. Same class
-- of gap as every prior "stated Roles column broader than the actual
-- policy" fix in this plan (class_sessions, programme_enrolments,
-- programme_attendance_records, report_acknowledgements).
-- `guardian_id = auth.uid()` is kept alongside `is_guardian_of` (not
-- replaced) so a guardian-level consent with a null `learner_id` -- not
-- reachable through this endpoint, but still governed by this same policy --
-- stays visible to the guardian who granted it.
alter policy "consents: guardian own or admin" on public.consents
  using (
    guardian_id = (select auth.uid())
    or (learner_id is not null and private.is_guardian_of(learner_id))
    or private.is_admin()
  );
