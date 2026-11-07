/**
 * `v_account_statement` (`db/migrations/20261020000011_billing.sql`). Checked
 * live via `pg_attribute`: `debit_cents` is `bigint` (the invoice branch's
 * `v_invoice_status.total_cents` widens the UNION ALL column), but
 * `credit_cents` stayed plain `integer` (every branch contributing to it is
 * either a literal `0` or a genuine `integer` column) — so only `debit_cents`
 * arrives as a string from `pg`; `credit_cents` is already a native number.
 * Both parsed with `Number(...)` in the mapper anyway for a uniform call site.
 */
export interface AccountStatementRow {
  billing_account_id: string;
  guardian_id: string;
  entry_type: string;
  reference: string;
  entry_date: string;
  debit_cents: string;
  credit_cents: number;
}
