export interface ProgrammeSessionRow {
  id: string;
  programme_id: string;
  session_date: string;
  starts_at: Date;
  ends_at: Date;
  tutor_id: string | null;
  status: string;
  meeting_url: string | null;
  notes: string;
}
