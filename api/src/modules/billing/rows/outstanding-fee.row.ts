/**
 * `v_outstanding_fees` (`db/migrations/20261020000013_finance_kpis.sql`).
 * Checked live via `pg_attribute`: `open_invoices` is `bigint` (a `count(*)`),
 * `outstanding_cents` is `numeric` (`sum()` over the view's own `bigint`
 * `balance_cents` widens further to `numeric`) — both arrive as strings from
 * `pg` and are parsed to `number` in the mapper. `max_days_overdue` is a
 * plain `integer` (`max()` preserves its input type, unlike `sum`).
 */
export interface OutstandingFeeRow {
  billing_account_id: string;
  guardian_id: string;
  guardian_name: string;
  open_invoices: string;
  outstanding_cents: string;
  max_days_overdue: number;
}
