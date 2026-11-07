export interface EnrolmentRow {
  id: string;
  learner_id: string;
  package_code: string;
  status: string;
  preferred_tutor_id: string | null;
  assigned_tutor_id: string | null;
  start_date: string | null;
  end_date: string | null;
  first_month_amount_cents: number | null;
  first_month_reason: string | null;
  source: string;
  created_at: Date;
  activated_at: Date | null;
}

export interface EnrolmentSubjectRow {
  enrolment_id: string;
  subject_code: string;
  preferred_language_code: string | null;
}
