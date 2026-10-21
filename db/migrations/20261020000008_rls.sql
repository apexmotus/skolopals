-- Row level security.
--
-- Helpers are SECURITY DEFINER in the `private` schema. That is deliberate:
-- running as the owner bypasses RLS inside the helper, which prevents the
-- infinite recursion you get when a policy on `learners` queries a table that
-- itself has a policy querying `learners`.

-- Helpers ------------------------------------------------------------------
create or replace function private.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists (
  select 1 from public.user_roles
  where user_id = (select auth.uid()) and role = p_role) $fn$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $fn$ select private.has_role('admin') $fn$;

create or replace function private.my_tutor_id()
returns uuid language sql stable security definer set search_path = ''
as $fn$ select id from public.tutors where profile_id = (select auth.uid()) $fn$;

create or replace function private.is_guardian_of(p_learner uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists (
  select 1 from public.learner_guardians
  where learner_id = p_learner and guardian_id = (select auth.uid())) $fn$;

create or replace function private.is_learner_self(p_learner uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists (
  select 1 from public.learners
  where id = p_learner and profile_id = (select auth.uid())) $fn$;

-- A tutor sees a learner only while that learner sits in a class they teach.
create or replace function private.tutor_teaches(p_learner uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists (
  select 1
  from public.class_enrolments ce
  join public.class_groups cg on cg.id = ce.class_group_id
  where ce.learner_id = p_learner
    and ce.left_on is null
    and cg.tutor_id = private.my_tutor_id()) $fn$;

-- Academic visibility: guardian, the learner, the teaching tutor, or admin.
create or replace function private.can_view_learner(p_learner uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select private.is_guardian_of(p_learner)
            or private.is_learner_self(p_learner)
            or private.tutor_teaches(p_learner)
            or private.is_admin() $fn$;

-- Pastoral/billing visibility: tutors excluded.
create or replace function private.can_view_learner_private(p_learner uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select private.is_guardian_of(p_learner) or private.is_admin() $fn$;

revoke execute on function
  private.has_role(public.app_role), private.is_admin(), private.my_tutor_id(),
  private.is_guardian_of(uuid), private.is_learner_self(uuid),
  private.tutor_teaches(uuid), private.can_view_learner(uuid),
  private.can_view_learner_private(uuid)
from public;
-- anon needs these too: the public tutor directory and timetable policies are
-- `to anon, authenticated` and call is_admin() in their USING clause. Without
-- the grant, a logged-out visitor gets "permission denied for function" and
-- the public site breaks. They are safe for anon - auth.uid() is null, so each
-- one returns false.
grant execute on function
  private.has_role(public.app_role), private.is_admin(), private.my_tutor_id(),
  private.is_guardian_of(uuid), private.is_learner_self(uuid),
  private.tutor_teaches(uuid), private.can_view_learner(uuid),
  private.can_view_learner_private(uuid)
to anon, authenticated;

-- Reference tables: admin may maintain them -------------------------------
create policy "school_phases: admin write"      on public.school_phases          for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "grades: admin write"             on public.grades                 for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "subjects: admin write"           on public.subjects               for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "offerings: admin write"          on public.subject_offerings      for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "languages: admin write"          on public.languages              for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "levels: admin write"             on public.achievement_levels     for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "terms: admin write"              on public.terms                  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "hours: admin write"              on public.centre_operating_hours for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "rooms: admin write"              on public.rooms                  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "packages: admin write"           on public.packages               for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "package_prices: admin write"     on public.package_prices         for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "billing_settings: admin only"    on public.billing_settings       for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "consent_types: admin write"      on public.consent_types          for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Accounts -----------------------------------------------------------------
create policy "profiles: read self or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());
create policy "profiles: update self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: admin write" on public.profiles for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "user_roles: read self or admin" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
-- No self-service role granting: only an admin may write here.
create policy "user_roles: admin write" on public.user_roles for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "guardians: self or admin" on public.guardians for all to authenticated
  using (profile_id = (select auth.uid()) or private.is_admin())
  with check (profile_id = (select auth.uid()) or private.is_admin());

-- Learners -----------------------------------------------------------------
create policy "learners: read if permitted" on public.learners for select to authenticated
  using (private.can_view_learner(id));
create policy "learners: guardian or admin write" on public.learners for all to authenticated
  using (private.can_view_learner_private(id))
  with check (private.can_view_learner_private(id) or private.is_admin());
-- A signed-in parent can register a new learner; the link row follows.
create policy "learners: parent create" on public.learners for insert to authenticated
  with check (private.has_role('parent'));

create policy "learner_guardians: read" on public.learner_guardians for select to authenticated
  using (private.can_view_learner(learner_id));
create policy "learner_guardians: guardian or admin write" on public.learner_guardians for all to authenticated
  using (guardian_id = (select auth.uid()) or private.is_admin())
  with check (guardian_id = (select auth.uid()) or private.is_admin());

-- Safeguarding. Tutors are NOT given emergency contacts or collectors; the
-- centre manager handles collection (POPIA policy A6).
create policy "emergency_contacts: guardian or admin" on public.learner_emergency_contacts for all to authenticated
  using (private.can_view_learner_private(learner_id))
  with check (private.can_view_learner_private(learner_id));
create policy "collectors: guardian or admin" on public.authorised_collectors for all to authenticated
  using (private.can_view_learner_private(learner_id))
  with check (private.can_view_learner_private(learner_id));

-- Special personal information (POPIA s26). Tutors explicitly excluded.
create policy "medical: guardian or admin only" on public.learner_medical_notes for all to authenticated
  using (private.can_view_learner_private(learner_id))
  with check (private.can_view_learner_private(learner_id));

-- Tutors -------------------------------------------------------------------
create policy "tutors: public read active" on public.tutors for select to anon, authenticated
  using (status = 'active' or profile_id = (select auth.uid()) or private.is_admin());
create policy "tutors: admin write" on public.tutors for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "tutors: own profile update" on public.tutors for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- The staff directory shows what each tutor teaches and speaks.
create policy "competencies: public read" on public.tutor_competencies for select to anon, authenticated using (true);
create policy "competencies: admin write" on public.tutor_competencies for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "media: public read" on public.tutor_competency_media for select to anon, authenticated using (true);
create policy "media: admin write" on public.tutor_competency_media for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "spoken: public read" on public.tutor_spoken_languages for select to anon, authenticated using (true);
create policy "spoken: admin write" on public.tutor_spoken_languages for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "quals: public read" on public.tutor_qualifications for select to anon, authenticated using (true);
create policy "quals: admin write" on public.tutor_qualifications for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Vetting material is admin-only (POPIA policy B5).
create policy "tutor_documents: admin only" on public.tutor_documents for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "tutor_references: admin only" on public.tutor_references for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "pay_rates: own or admin" on public.tutor_pay_rates for select to authenticated
  using (tutor_id = private.my_tutor_id() or private.is_admin());
create policy "pay_rates: admin write" on public.tutor_pay_rates for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Enrolment ----------------------------------------------------------------
create policy "enrolments: read if permitted" on public.enrolments for select to authenticated
  using (private.can_view_learner_private(learner_id)
      or assigned_tutor_id = private.my_tutor_id());
create policy "enrolments: guardian create" on public.enrolments for insert to authenticated
  with check (private.is_guardian_of(learner_id) and status = 'pending');
create policy "enrolments: admin write" on public.enrolments for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "enrolment_subjects: read" on public.enrolment_subjects for select to authenticated
  using (exists (select 1 from public.enrolments e where e.id = enrolment_id
                 and (private.can_view_learner_private(e.learner_id)
                      or e.assigned_tutor_id = private.my_tutor_id())));
create policy "enrolment_subjects: guardian create" on public.enrolment_subjects for insert to authenticated
  with check (exists (select 1 from public.enrolments e where e.id = enrolment_id
                      and private.is_guardian_of(e.learner_id) and e.status = 'pending'));
create policy "enrolment_subjects: admin write" on public.enrolment_subjects for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Timetable ----------------------------------------------------------------
-- class_sessions is NOT public: it carries meeting_url. The published
-- timetable is the v_public_timetable view below, which omits it.
create policy "class_groups: public read" on public.class_groups for select to anon, authenticated
  using (is_active or private.is_admin());
create policy "class_groups: admin write" on public.class_groups for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "class_grades: public read" on public.class_group_grades for select to anon, authenticated using (true);
create policy "class_grades: admin write" on public.class_group_grades for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "schedules: public read" on public.class_schedules for select to anon, authenticated using (true);
create policy "schedules: admin write" on public.class_schedules for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "sessions: participants read" on public.class_sessions for select to authenticated
  using (private.is_admin()
      or tutor_id = private.my_tutor_id()
      or exists (select 1 from public.class_groups cg
                 where cg.id = class_group_id and cg.tutor_id = private.my_tutor_id())
      or exists (select 1 from public.class_enrolments ce
                 where ce.class_group_id = class_sessions.class_group_id
                   and ce.left_on is null
                   and private.can_view_learner(ce.learner_id)));
create policy "sessions: admin write" on public.class_sessions for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "class_enrolments: read" on public.class_enrolments for select to authenticated
  using (private.can_view_learner(learner_id)
      or exists (select 1 from public.class_groups cg
                 where cg.id = class_group_id and cg.tutor_id = private.my_tutor_id()));
create policy "class_enrolments: admin write" on public.class_enrolments for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Attendance: the teaching tutor marks it; parents and admin read it.
create policy "attendance: read" on public.attendance_records for select to authenticated
  using (private.can_view_learner(learner_id));
create policy "attendance: tutor marks own session" on public.attendance_records for insert to authenticated
  with check (exists (select 1 from public.class_sessions s
                      join public.class_groups cg on cg.id = s.class_group_id
                      where s.id = class_session_id
                        and coalesce(s.tutor_id, cg.tutor_id) = private.my_tutor_id()));
create policy "attendance: tutor corrects own session" on public.attendance_records for update to authenticated
  using (exists (select 1 from public.class_sessions s
                 join public.class_groups cg on cg.id = s.class_group_id
                 where s.id = class_session_id
                   and coalesce(s.tutor_id, cg.tutor_id) = private.my_tutor_id()));
create policy "attendance: admin write" on public.attendance_records for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Sign in / out is a front-desk function: admin writes, guardians read.
create policy "check_ins: read" on public.session_check_ins for select to authenticated
  using (private.can_view_learner_private(learner_id)
      or exists (select 1 from public.class_sessions s
                 join public.class_groups cg on cg.id = s.class_group_id
                 where s.id = class_session_id
                   and coalesce(s.tutor_id, cg.tutor_id) = private.my_tutor_id()));
create policy "check_ins: admin write" on public.session_check_ins for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- POPIA --------------------------------------------------------------------
create policy "consents: guardian own or admin" on public.consents for select to authenticated
  using (guardian_id = (select auth.uid()) or private.is_admin());
create policy "consents: guardian records own" on public.consents for insert to authenticated
  with check (guardian_id = (select auth.uid()));
-- Withdrawal is an update by the guardian who granted it.
create policy "consents: guardian withdraws own" on public.consents for update to authenticated
  using (guardian_id = (select auth.uid())) with check (guardian_id = (select auth.uid()));
create policy "consents: admin write" on public.consents for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "retention_policies: admin only" on public.data_retention_policies for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "retention_log: admin only" on public.data_retention_log for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Published timetable ------------------------------------------------------
-- DELIBERATELY definer-rights (security_invoker left off). This is the one
-- view that must bypass RLS: it publishes the timetable to anonymous visitors
-- without opening class_sessions, which holds meeting_url. Its column list is
-- the security boundary. Every OTHER view in this schema sets
-- security_invoker = true - without it a view silently bypasses RLS and leaks
-- its base tables, which is how v_account_statement first exposed every
-- family's billing to tutors.
create view public.v_public_timetable as
select cg.id            as class_group_id,
       cg.name          as class_name,
       s.name           as subject,
       l.name           as language,
       cg.delivery_mode,
       cg.capacity,
       sch.day_of_week,
       sch.starts_at_time,
       sch.ends_at_time,
       t.slug           as tutor_slug,
       p.full_name      as tutor_name
from public.class_groups cg
join public.class_schedules sch on sch.class_group_id = cg.id
join public.subjects  s on s.code = cg.subject_code
join public.languages l on l.code = cg.language_code
join public.tutors    t on t.id   = cg.tutor_id
join public.profiles  p on p.id   = t.profile_id
where cg.is_active and t.status = 'active';

comment on view public.v_public_timetable is
  'Published class timetable. Deliberately omits meeting_url - online links '
  'are visible only to enrolled families via class_sessions.';

grant select on public.v_public_timetable to anon, authenticated;

-- Grants -------------------------------------------------------------------
-- Writes are granted narrowly and then gated by the policies above.
grant select on all tables in schema public to anon, authenticated;

grant insert, update on
  public.profiles, public.guardians, public.learners, public.learner_guardians,
  public.learner_emergency_contacts, public.authorised_collectors,
  public.learner_medical_notes, public.enrolments, public.enrolment_subjects,
  public.consents, public.attendance_records
to authenticated;

grant delete on
  public.learner_emergency_contacts, public.authorised_collectors,
  public.enrolment_subjects
to authenticated;

-- anon may read the public site and nothing else.
revoke insert, update, delete on all tables in schema public from anon;
