export interface PaymentRow {
  id: string;
  billing_account_id: string;
  paid_on: string;
  amount_cents: number;
  method: string;
  reference: string;
  recorded_by: string | null;
  created_at: Date;
}
