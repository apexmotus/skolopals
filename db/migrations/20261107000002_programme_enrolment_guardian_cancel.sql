-- programme_enrolments had a guardian INSERT policy ("guardian books") and
-- an admin ALL policy, but no guardian UPDATE policy — so a guardian could
-- book but never cancel their own booking. BP intent (and the API plan's
-- POST /programmes/:id/enrolments/:enrolmentId/cancel, Roles: Guardian-of +
-- Admin) requires the booking guardian to cancel it themselves. Scoped to
-- the learner they are guardian of, same `is_guardian_of` check already used
-- by the insert policy — a guardian can only ever set their OWN booking's
-- status, never anyone else's, via either USING or WITH CHECK.
create policy "programme_enrolments: guardian cancels own" on public.programme_enrolments for update to authenticated
  using (private.is_guardian_of(learner_id))
  with check (private.is_guardian_of(learner_id));
