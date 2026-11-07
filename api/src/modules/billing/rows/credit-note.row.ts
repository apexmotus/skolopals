export interface CreditNoteRow {
  id: string;
  billing_account_id: string;
  issued_on: string;
  amount_cents: number;
  reason: string;
  issued_by: string | null;
}
