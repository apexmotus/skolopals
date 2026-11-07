export interface SessionCheckInRow {
  id: string;
  class_session_id: string;
  learner_id: string;
  arrived_at: Date;
  signed_in_by: string | null;
  departed_at: Date | null;
  collected_by: string | null;
  signed_out_by: string | null;
  note: string;
}
