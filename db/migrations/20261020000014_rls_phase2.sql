-- Row level security for the Phase 2 tables.
-- Same rule as Phase 1: tutors see academic data for learners they teach, and
-- never billing, health or consent data.

-- Billing visibility: the guardian who owns the account, or an admin.
create or replace function private.owns_billing_account(p_account uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists (
  select 1 from public.billing_accounts
  where id = p_account and guardian_id = (select auth.uid())) $fn$;

create or replace function private.in_thread(p_thread uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists (
  select 1 from public.thread_participants
  where thread_id = p_thread and profile_id = (select auth.uid())) $fn$;

grant execute on function private.owns_billing_account(uuid), private.in_thread(uuid)
  to anon, authenticated;

-- Programmes ---------------------------------------------------------------
create policy "programmes: public read published" on public.programmes for select to anon, authenticated
  using (is_published or private.is_admin());
create policy "programmes: admin write" on public.programmes for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "programme_sessions: participants read" on public.programme_sessions for select to authenticated
  using (private.is_admin() or tutor_id = private.my_tutor_id()
      or exists (select 1 from public.programme_enrolments pe
                 where pe.programme_id = programme_sessions.programme_id
                   and pe.status = 'booked'
                   and private.can_view_learner(pe.learner_id)));
create policy "programme_sessions: admin write" on public.programme_sessions for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "programme_enrolments: read" on public.programme_enrolments for select to authenticated
  using (private.can_view_learner(learner_id));
create policy "programme_enrolments: guardian books" on public.programme_enrolments for insert to authenticated
  with check (private.is_guardian_of(learner_id));
create policy "programme_enrolments: admin write" on public.programme_enrolments for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "programme_attendance: read" on public.programme_attendance_records for select to authenticated
  using (private.can_view_learner(learner_id));
create policy "programme_attendance: tutor marks" on public.programme_attendance_records for insert to authenticated
  with check (exists (select 1 from public.programme_sessions ps
                      where ps.id = programme_session_id and ps.tutor_id = private.my_tutor_id()));
create policy "programme_attendance: admin write" on public.programme_attendance_records for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Assessment ---------------------------------------------------------------
create policy "assessment_types: public read" on public.assessment_types for select to anon, authenticated using (true);
create policy "assessment_types: admin write" on public.assessment_types for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "assessment_domains: public read" on public.assessment_domains for select to anon, authenticated using (true);
create policy "assessment_domains: admin write" on public.assessment_domains for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "assessments: read if permitted" on public.assessments for select to authenticated
  using (private.can_view_learner(learner_id));
create policy "assessments: teaching tutor writes" on public.assessments for insert to authenticated
  with check (private.tutor_teaches(learner_id) and administered_by = private.my_tutor_id());
create policy "assessments: teaching tutor corrects" on public.assessments for update to authenticated
  using (administered_by = private.my_tutor_id());
create policy "assessments: admin write" on public.assessments for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "assessment_scores: read" on public.assessment_scores for select to authenticated
  using (exists (select 1 from public.assessments a where a.id = assessment_id
                 and private.can_view_learner(a.learner_id)));
create policy "assessment_scores: tutor writes" on public.assessment_scores for all to authenticated
  using (exists (select 1 from public.assessments a where a.id = assessment_id
                 and a.administered_by = private.my_tutor_id()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id
                      and a.administered_by = private.my_tutor_id()));
create policy "assessment_scores: admin write" on public.assessment_scores for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "learning_plans: read" on public.learning_plans for select to authenticated
  using (private.can_view_learner(learner_id));
create policy "learning_plans: tutor writes" on public.learning_plans for all to authenticated
  using (private.tutor_teaches(learner_id)) with check (private.tutor_teaches(learner_id));
create policy "learning_plans: admin write" on public.learning_plans for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "plan_goals: read" on public.learning_plan_goals for select to authenticated
  using (exists (select 1 from public.learning_plans p where p.id = learning_plan_id
                 and private.can_view_learner(p.learner_id)));
create policy "plan_goals: tutor writes" on public.learning_plan_goals for all to authenticated
  using (exists (select 1 from public.learning_plans p where p.id = learning_plan_id
                 and private.tutor_teaches(p.learner_id)))
  with check (exists (select 1 from public.learning_plans p where p.id = learning_plan_id
                      and private.tutor_teaches(p.learner_id)));
create policy "plan_goals: admin write" on public.learning_plan_goals for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Reports. A parent sees a report only once it is PUBLISHED; a draft is the
-- tutor's working copy.
create policy "reports: parent sees published" on public.progress_reports for select to authenticated
  using ((published_at is not null and private.can_view_learner(learner_id))
      or private.tutor_teaches(learner_id)
      or private.is_admin());
create policy "reports: tutor writes" on public.progress_reports for all to authenticated
  using (private.tutor_teaches(learner_id)) with check (private.tutor_teaches(learner_id));
create policy "reports: admin write" on public.progress_reports for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "report_subjects: read" on public.progress_report_subjects for select to authenticated
  using (exists (select 1 from public.progress_reports r where r.id = progress_report_id
                 and ((r.published_at is not null and private.can_view_learner(r.learner_id))
                      or private.tutor_teaches(r.learner_id) or private.is_admin())));
create policy "report_subjects: tutor writes" on public.progress_report_subjects for all to authenticated
  using (exists (select 1 from public.progress_reports r where r.id = progress_report_id
                 and private.tutor_teaches(r.learner_id)))
  with check (exists (select 1 from public.progress_reports r where r.id = progress_report_id
                      and private.tutor_teaches(r.learner_id)));
create policy "report_subjects: admin write" on public.progress_report_subjects for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "acks: read" on public.report_acknowledgements for select to authenticated
  using (guardian_id = (select auth.uid())
      or exists (select 1 from public.progress_reports r where r.id = progress_report_id
                 and (private.tutor_teaches(r.learner_id) or private.is_admin())));
create policy "acks: guardian acknowledges" on public.report_acknowledgements for insert to authenticated
  with check (guardian_id = (select auth.uid()));

-- Billing. Tutors have no access at all.
create policy "billing_accounts: owner or admin" on public.billing_accounts for select to authenticated
  using (guardian_id = (select auth.uid()) or private.is_admin());
create policy "billing_accounts: admin write" on public.billing_accounts for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "invoice_sequences: admin only" on public.invoice_sequences for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "invoices: owner or admin" on public.invoices for select to authenticated
  using (private.owns_billing_account(billing_account_id) or private.is_admin());
create policy "invoices: admin write" on public.invoices for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "invoice_lines: owner or admin" on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id
                 and (private.owns_billing_account(i.billing_account_id) or private.is_admin())));
create policy "invoice_lines: admin write" on public.invoice_lines for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "payments: owner or admin" on public.payments for select to authenticated
  using (private.owns_billing_account(billing_account_id) or private.is_admin());
create policy "payments: admin write" on public.payments for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "payment_allocations: owner or admin" on public.payment_allocations for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id
                 and (private.owns_billing_account(i.billing_account_id) or private.is_admin())));
create policy "payment_allocations: admin write" on public.payment_allocations for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "credit_notes: owner or admin" on public.credit_notes for select to authenticated
  using (private.owns_billing_account(billing_account_id) or private.is_admin());
create policy "credit_notes: admin write" on public.credit_notes for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "credit_allocations: owner or admin" on public.credit_note_allocations for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id
                 and (private.owns_billing_account(i.billing_account_id) or private.is_admin())));
create policy "credit_allocations: admin write" on public.credit_note_allocations for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Communication ------------------------------------------------------------
create policy "threads: participants" on public.message_threads for select to authenticated
  using (private.in_thread(id) or private.is_admin());
create policy "threads: create" on public.message_threads for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "threads: admin write" on public.message_threads for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "participants: read" on public.thread_participants for select to authenticated
  using (private.in_thread(thread_id) or private.is_admin());
create policy "participants: thread member adds" on public.thread_participants for insert to authenticated
  with check (private.in_thread(thread_id) or private.is_admin()
           or exists (select 1 from public.message_threads t
                      where t.id = thread_id and t.created_by = (select auth.uid())));

create policy "messages: participants read" on public.messages for select to authenticated
  using (private.in_thread(thread_id) or private.is_admin());
create policy "messages: send as self into own thread" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.in_thread(thread_id));

create policy "message_reads: own" on public.message_reads for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

create policy "notifications: recipients read" on public.notifications for select to authenticated
  using (private.is_admin()
      or exists (select 1 from public.notification_recipients nr
                 where nr.notification_id = id and nr.profile_id = (select auth.uid())));
create policy "notifications: admin write" on public.notifications for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "notification_recipients: own" on public.notification_recipients for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_admin());
create policy "notification_recipients: own mark read" on public.notification_recipients for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "notification_recipients: admin write" on public.notification_recipients for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Anyone may submit an enquiry; only admins may read them.
create policy "enquiries: anyone submits" on public.contact_enquiries for insert to anon, authenticated
  with check (status = 'new' and handled_by is null and converted_learner_id is null);
create policy "enquiries: admin reads" on public.contact_enquiries for select to authenticated
  using (private.is_admin());
create policy "enquiries: admin write" on public.contact_enquiries for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy "resources: read if targeted" on public.resources for select to authenticated
  using (private.is_admin() or created_by = (select auth.uid())
      or exists (
        select 1 from public.resource_audiences ra
        where ra.resource_id = resources.id
          and (ra.audience_type = 'all'
            or (ra.audience_type = 'learner'     and private.can_view_learner(ra.learner_id))
            or (ra.audience_type = 'grade'       and exists (
                  select 1 from public.learners l
                  where l.grade_code = ra.grade_code and private.can_view_learner(l.id)))
            or (ra.audience_type = 'class_group' and exists (
                  select 1 from public.class_enrolments ce
                  where ce.class_group_id = ra.class_group_id and ce.left_on is null
                    and private.can_view_learner(ce.learner_id))))));
create policy "resources: tutor or admin write" on public.resources for all to authenticated
  using (created_by = (select auth.uid()) or private.is_admin())
  with check (created_by = (select auth.uid()) or private.is_admin());

create policy "resource_audiences: read" on public.resource_audiences for select to authenticated
  using (exists (select 1 from public.resources r where r.id = resource_id));
create policy "resource_audiences: owner write" on public.resource_audiences for all to authenticated
  using (exists (select 1 from public.resources r where r.id = resource_id
                 and (r.created_by = (select auth.uid()) or private.is_admin())))
  with check (exists (select 1 from public.resources r where r.id = resource_id
                      and (r.created_by = (select auth.uid()) or private.is_admin())));

-- Only published reviews are public; a guardian always sees their own.
create policy "reviews: public sees published" on public.reviews for select to anon, authenticated
  using (status = 'published' or guardian_id = (select auth.uid()) or private.is_admin());
create policy "reviews: guardian writes pending" on public.reviews for insert to authenticated
  with check (guardian_id = (select auth.uid()) and status = 'pending');
create policy "reviews: admin moderates" on public.reviews for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Finance ------------------------------------------------------------------
create policy "expense_categories: admin only" on public.expense_categories for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "expenses: admin only" on public.expenses for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Grants -------------------------------------------------------------------
grant select on all tables in schema public to anon, authenticated;

grant insert, update on
  public.programme_enrolments, public.assessments, public.assessment_scores,
  public.learning_plans, public.learning_plan_goals, public.progress_reports,
  public.progress_report_subjects, public.report_acknowledgements,
  public.programme_attendance_records, public.message_threads,
  public.thread_participants, public.messages, public.message_reads,
  public.notification_recipients, public.resources, public.resource_audiences,
  public.reviews
to authenticated;

grant delete on
  public.learning_plan_goals, public.progress_report_subjects,
  public.resource_audiences, public.assessment_scores
to authenticated;

grant insert on public.contact_enquiries to anon, authenticated;

-- anon may submit an enquiry and nothing else.
revoke update, delete on all tables in schema public from anon;
