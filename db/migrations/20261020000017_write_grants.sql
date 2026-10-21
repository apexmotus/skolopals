-- Table grants for the authenticated role.
--
-- RLS policies decide WHO may write a row; a GRANT decides whether the role
-- may attempt the statement at all. Both are needed. Phase 1 and 2 granted
-- writes only on the tables parents and tutors touch, which left every
-- admin-managed table ungranted - the policies existed and could never fire.
--
-- The model from here is the usual Supabase one: grant the statement to
-- `authenticated`, and let RLS be the control. `anon` stays locked down.

grant insert, update on all tables in schema public to authenticated;

-- `all tables` includes the migration ledger, which is infrastructure.
revoke all on public.schema_migrations from anon, authenticated;

-- DELETE is granted deliberately, not broadly. These are rows that are edited
-- as sets - a class's weekly slots, the subjects on an enrolment, the lines on
-- a draft invoice - where removing one is ordinary editing.
grant delete on
  public.class_schedules, public.class_group_grades, public.class_sessions,
  public.class_enrolments, public.tutor_competencies, public.tutor_competency_media,
  public.tutor_spoken_languages, public.tutor_qualifications, public.tutor_references,
  public.tutor_documents, public.tutor_pay_rates, public.enrolment_subjects,
  public.invoice_lines, public.payment_allocations, public.credit_note_allocations,
  public.resource_audiences, public.assessment_scores, public.learning_plan_goals,
  public.progress_report_subjects, public.programme_sessions, public.programme_enrolments,
  public.notification_recipients, public.thread_participants, public.expenses,
  public.subject_offerings, public.learner_emergency_contacts, public.authorised_collectors
to authenticated;

-- Not deletable by anyone through the API, on purpose:
--   learners, enrolments, invoices, payments, consents, attendance_records,
--   assessments, progress_reports, data_retention_log
-- These carry POPIA retention, financial history or an audit trail. Removing
-- them is the retention job's business, with administrator confirmation, not
-- a stray DELETE from a screen.

-- Append-only by design. These are records of what happened, not state:
--   messages                - what was actually said to a parent
--   report_acknowledgements - that a parent saw a particular report
--   thread_participants     - membership changes by adding or removing a row
-- Editing one after the fact would rewrite history, so UPDATE is withheld and
-- the absence of an UPDATE policy is deliberate, not an oversight.
revoke update on public.messages, public.report_acknowledgements,
                 public.thread_participants
from authenticated;

-- anon submits an enquiry and reads the public site. Nothing else.
revoke insert, update, delete on all tables in schema public from anon;
grant insert on public.contact_enquiries to anon;
