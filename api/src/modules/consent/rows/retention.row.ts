/** `v_retention_due` (`db/migrations/20261020000007_consent_retention.sql`). Read-only and informational — nothing here ever deletes anything. */
export interface RetentionDueRow {
  record_class: string;
  subject_id: string;
  subject_label: string;
  left_on: string;
  retention_months: number;
  due_on: string;
}

export interface RetentionLogRow {
  id: string;
  record_class: string;
  subject_id: string;
  subject_label: string;
  action: string;
  performed_at: Date;
  confirmed_by: string | null;
  note: string;
}
