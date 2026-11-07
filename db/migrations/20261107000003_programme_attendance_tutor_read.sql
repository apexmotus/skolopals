-- programme_attendance_records' read policy only checked can_view_learner(),
-- which resolves "teaching tutor" via class_enrolments/class_groups only
-- (private.tutor_teaches()) — it has no concept of a programme session's own
-- tutor_id. The INSERT policy ("programme_attendance: tutor marks") already
-- correctly checks `programme_sessions.tutor_id = my_tutor_id()` directly, so
-- a tutor assigned to a programme session could mark attendance they could
-- then never read back, contradicting the API plan's endpoint table (both
-- GET and POST /programme-sessions/:id/attendance list "teaching Tutor").
-- Broaden the read policy with the same direct tutor_id check the insert
-- policy already uses, via ALTER POLICY rather than drop+recreate so the
-- policy's identity/name is unchanged.
alter policy "programme_attendance: read" on public.programme_attendance_records
  using (private.can_view_learner(learner_id)
      or exists (select 1 from public.programme_sessions ps
                 where ps.id = programme_session_id and ps.tutor_id = private.my_tutor_id()));
