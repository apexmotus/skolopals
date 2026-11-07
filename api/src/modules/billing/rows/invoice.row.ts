/**
 * Embedded via `json_agg`, not a separate endpoint — there is no standalone
 * "list lines" endpoint, same reasoning as `assessment`'s scores/goals.
 * `quantity` is `numeric(6,2)` but arrives as a native JS `number` here
 * (confirmed live, `node -e` against local Postgres): unlike a *top-level*
 * `numeric` column — which `pg` always returns as a string — a `numeric`
 * value nested inside `json_build_object` is serialized by Postgres's own
 * JSON functions as an unquoted JSON number, so `JSON.parse` (how `pg`
 * decodes a `json` column) hands back a real number, not a string. Safe at
 * this scale (quantities, never money). `unit_amount_cents`/`line_total_cents`
 * are plain `integer`, native JS numbers either way.
 */
export interface InvoiceLineRow {
  id: string;
  line_type: string;
  description: string;
  enrolment_id: string | null;
  programme_enrolment_id: string | null;
  package_code: string | null;
  learner_id: string | null;
  quantity: number;
  unit_amount_cents: number;
  line_total_cents: number;
  /** `date` — nested JSON serializes it as a quoted ISO string already, same shape as the top-level, custom-parsed representation. */
  period_month: string | null;
}

/**
 * Joins `invoices` with `v_invoice_status` (`db/migrations/20261020000011_billing.sql`),
 * the view that derives paid/part-paid/overdue — never stored. `total_cents`/
 * `settled_cents`/`balance_cents` are confirmed `bigint` columns on that view
 * (`pg_attribute` checked live), so `pg` returns them as strings; parsed to
 * `number` in `BillingMapper` (safe at this scale, same convention as every
 * prior module's `count(*) over()` → `total_count` parse).
 */
export interface InvoiceRow {
  id: string;
  billing_account_id: string;
  invoice_number: string;
  period_start: string | null;
  period_end: string | null;
  issued_on: string;
  due_on: string;
  status: string;
  notes: string;
  created_at: Date;
  total_cents: string;
  settled_cents: string;
  balance_cents: string;
  payment_state: string;
  days_overdue: number;
  lines: InvoiceLineRow[];
}

/** `public.run_monthly_invoices`'s result set — `total_cents bigint`, confirmed by the function's own `::bigint` cast. */
export interface RunMonthlyInvoicesRow {
  invoice_id: string;
  billing_account_id: string;
  total_cents: string;
}
