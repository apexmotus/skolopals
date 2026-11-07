-- report_acknowledgements' insert policy ("acks: guardian acknowledges") only
-- checked `guardian_id = auth.uid()` -- that a guardian is acknowledging as
-- themselves, but not that they are actually a guardian of the report's own
-- learner. Since the primary key is (progress_report_id, guardian_id) and the
-- insert check never joins back to progress_reports/learner_guardians, any
-- authenticated guardian who learns another family's published report id
-- could record an acknowledgement against it, contradicting the API plan's
-- endpoint table ("POST /progress-reports/:id/acknowledge" — role
-- "Guardian-of", not "any guardian"). Same class of gap as the three found
-- during Phase 3b (class_sessions write, programme_enrolments guardian-
-- cancel, programme_attendance_records tutor-read): a table's own policy did
-- not reproduce an entitlement another sibling policy in the same migration
-- already defines (`is_guardian_of`, used by "programme_enrolments: guardian
-- books"/"programme_enrolments: guardian cancels").
-- Fixed via ALTER POLICY (not drop+recreate) so the policy's name/identity is
-- unchanged, same approach as the two Phase 3b fixes above.
alter policy "acks: guardian acknowledges" on public.report_acknowledgements
  with check (
    guardian_id = (select auth.uid())
    and exists (
      select 1 from public.progress_reports r
      where r.id = report_acknowledgements.progress_report_id
        and private.is_guardian_of(r.learner_id)
    )
  );
