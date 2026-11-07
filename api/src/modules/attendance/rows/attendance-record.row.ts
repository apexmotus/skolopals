export interface AttendanceRecordRow {
  id: string;
  class_session_id: string;
  learner_id: string;
  status: string;
  marked_by: string | null;
  marked_at: Date;
  note: string;
}
