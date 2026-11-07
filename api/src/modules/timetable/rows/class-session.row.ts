export interface ClassSessionRow {
  id: string;
  class_group_id: string;
  schedule_id: string | null;
  session_date: string;
  starts_at: Date;
  ends_at: Date;
  status: string;
  tutor_id: string | null;
  meeting_url: string | null;
  notes: string;
  created_at: Date;
}
