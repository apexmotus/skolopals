-- A substitute can see the class they are covering.
--
-- class_sessions.tutor_id names a substitute for one occurrence, and the
-- attendance policies already let that substitute mark the register. But
-- tutor_teaches only counted the class's own tutor, so a substitute could not
-- read who is placed in the class, or their names, and the register showed no
-- learners.
--
-- tutor_teaches now also counts a tutor covering a session of the learner's
-- class, from a week before that session to two weeks after it (time to mark
-- a late register), and never for a cancelled one. Everything that means "the
-- teaching tutor" (learner names, placements, academic records) follows; billing
-- and the other guardian-only data stay out of reach, as for any tutor.

create or replace function private.tutor_teaches(p_learner uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists (
  select 1
  from public.class_enrolments ce
  join public.class_groups cg on cg.id = ce.class_group_id
  where ce.learner_id = p_learner
    and ce.left_on is null
    and (cg.tutor_id = private.my_tutor_id()
         or exists (select 1 from public.class_sessions s
                    where s.class_group_id = cg.id
                      and s.tutor_id = private.my_tutor_id()
                      and s.status <> 'cancelled'
                      and s.session_date between current_date - 14 and current_date + 7))) $fn$;
