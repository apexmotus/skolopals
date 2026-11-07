export interface ProgrammeAttendanceRow {
  id: string;
  programme_session_id: string;
  learner_id: string;
  status: string;
  marked_by: string | null;
  marked_at: Date;
  note: string;
}
