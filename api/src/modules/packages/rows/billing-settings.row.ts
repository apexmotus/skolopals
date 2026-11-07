export interface BillingSettingsRow {
  id: string;
  invoice_prefix: string;
  issue_day: number;
  due_day: number;
  grace_days: number;
  late_fee_cents: number;
  effective_from: string;
  effective_to: string | null;
}
