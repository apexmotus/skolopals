export interface TutorPayRateRow {
  id: string;
  tutor_id: string;
  pay_basis: string;
  amount_cents: number;
  effective_from: string;
  effective_to: string | null;
  created_at: Date;
}
