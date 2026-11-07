export interface ReviewRow {
  id: string;
  tutor_id: string;
  guardian_id: string;
  learner_id: string | null;
  rating: number;
  comment: string;
  status: string;
  created_at: Date;
  published_at: Date | null;
  moderated_by: string | null;
}
