-- class_sessions had only an admin-only write policy ("sessions: admin
-- write"), with no path for the session's own tutor to mark it held/
-- cancelled or add notes. BP intent (and the API plan's PATCH
-- /class-sessions/:id, Roles: Admin + teaching Tutor) requires the teaching
-- tutor to update their own session's status/notes/meeting_url directly.
-- Mirrors the existing "attendance: tutor corrects own session" pattern:
-- the session's own tutor_id if set (a substitute for that occurrence),
-- falling back to the class group's tutor_id.
create policy "sessions: teaching tutor updates own" on public.class_sessions for update to authenticated
  using (exists (select 1 from public.class_groups cg
                 where cg.id = class_group_id
                   and coalesce(tutor_id, cg.tutor_id) = private.my_tutor_id()))
  with check (exists (select 1 from public.class_groups cg
                 where cg.id = class_group_id
                   and coalesce(tutor_id, cg.tutor_id) = private.my_tutor_id()));
