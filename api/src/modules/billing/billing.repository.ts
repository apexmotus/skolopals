import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param.js';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { AccountStatementRow } from './rows/account-statement.row.js';
import type { BillingAccountRow } from './rows/billing-account.row.js';
import type { CreditNoteRow } from './rows/credit-note.row.js';
import type { InvoiceRow, RunMonthlyInvoicesRow } from './rows/invoice.row.js';
import type { OutstandingFeeRow } from './rows/outstanding-fee.row.js';
import type { PaymentRow } from './rows/payment.row.js';

const BILLING_ACCOUNT_COLUMNS = 'id, guardian_id, status, created_at';

const PAYMENT_COLUMNS =
  'id, billing_account_id, paid_on, amount_cents, method, reference, recorded_by, created_at';

const CREDIT_NOTE_COLUMNS =
  'id, billing_account_id, issued_on, amount_cents, reason, issued_by';

/** Both ends of a join across `invoices` + `v_invoice_status`, with lines embedded via `json_agg` — see `rows/invoice.row.ts` for why the lines columns stay snake_case. */
const INVOICE_COLUMNS_WITH_STATUS_AND_LINES = `
  i.id, i.billing_account_id, i.invoice_number, i.period_start, i.period_end,
  i.issued_on, i.due_on, i.status, i.notes, i.created_at,
  v.total_cents, v.settled_cents, v.balance_cents, v.payment_state, v.days_overdue,
  coalesce(
    (select json_agg(json_build_object(
       'id', l.id, 'line_type', l.line_type, 'description', l.description,
       'enrolment_id', l.enrolment_id, 'programme_enrolment_id', l.programme_enrolment_id,
       'package_code', l.package_code, 'learner_id', l.learner_id,
       'quantity', l.quantity, 'unit_amount_cents', l.unit_amount_cents,
       'line_total_cents', l.line_total_cents, 'period_month', l.period_month
     ) order by l.description)
     from public.invoice_lines l where l.invoice_id = i.id),
    '[]'::json
  ) as lines
`;

/**
 * The highest-stakes module in the plan (`10-phase3d-billing.md`'s own
 * framing). `run_monthly_invoices`/`apply_late_fees`/`record_payment`
 * (`db/migrations/20261020000020_billing_run.sql`) and
 * `next_invoice_number` (called internally by all three, and by
 * `activate_enrolment` — never from this Repository) are the only real
 * functions this module touches; everything else — accounts, invoices,
 * invoice lines, payments, credit notes — is plain parameterized SQL under
 * RLS, same convention as `timetable`/`programmes`. `v_invoice_status`
 * (never-stored derived payment state), `v_account_statement` and
 * `v_outstanding_fees` are read directly, never re-derived here.
 */
@Injectable()
export class BillingRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  getBillingAccountByGuardian(guardianId: string): Promise<BillingAccountRow | undefined> {
    return this.sp.selectOne<BillingAccountRow>(
      `select ${BILLING_ACCOUNT_COLUMNS} from public.billing_accounts where guardian_id = $1`,
      [guardianId],
    );
  }

  getBillingAccountById(id: string): Promise<BillingAccountRow | undefined> {
    return this.sp.selectOne<BillingAccountRow>(
      `select ${BILLING_ACCOUNT_COLUMNS} from public.billing_accounts where id = $1`,
      [id],
    );
  }

  getStatement(billingAccountId: string): Promise<AccountStatementRow[]> {
    return this.sp.selectMany<AccountStatementRow>(
      `select billing_account_id, guardian_id, entry_type, reference, entry_date, debit_cents, credit_cents
       from public.v_account_statement
       where billing_account_id = $1
       order by entry_date, entry_type`,
      [billingAccountId],
    );
  }

  getInvoiceById(id: string): Promise<InvoiceRow | undefined> {
    return this.sp.selectOne<InvoiceRow>(
      `select ${INVOICE_COLUMNS_WITH_STATUS_AND_LINES}
       from public.invoices i
       join public.v_invoice_status v on v.id = i.id
       where i.id = $1`,
      [id],
    );
  }

  listInvoices(billingAccountId: string): Promise<InvoiceRow[]> {
    return this.sp.selectMany<InvoiceRow>(
      `select ${INVOICE_COLUMNS_WITH_STATUS_AND_LINES}
       from public.invoices i
       join public.v_invoice_status v on v.id = i.id
       where i.billing_account_id = $1
       order by i.issued_on desc`,
      [billingAccountId],
    );
  }

  /**
   * `p_period` is omitted entirely (never passed as `null`) when the caller
   * didn't supply one, so Postgres's own default (`current_date + 1 month`,
   * truncated) resolves it — the function logs no DB-clock dependence back
   * into application code, same "no app-layer tz math" rule as every other
   * optional SQL-defaulted date param in this codebase.
   */
  runMonthly(period?: string): Promise<RunMonthlyInvoicesRow[]> {
    const params = period ? [p.date('p_period', period)] : [];
    return this.sp.queryMany<RunMonthlyInvoicesRow>('public.run_monthly_invoices', params);
  }

  async applyLateFees(onDate?: string): Promise<number> {
    const params = onDate ? [p.date('p_on', onDate)] : [];
    const row = await this.sp.queryOne<{ apply_late_fees: number }>(
      'public.apply_late_fees',
      params,
    );
    if (!row) throw new Error('apply_late_fees unexpectedly returned no row');
    return row.apply_late_fees;
  }

  async recordPayment(input: {
    billingAccountId: string;
    amountCents: number;
    method: string;
    reference?: string;
    paidOn?: string;
  }): Promise<string> {
    const params = [
      p.uuid('p_billing_account_id', input.billingAccountId),
      p.int('p_amount_cents', input.amountCents),
      p.text('p_method', input.method),
      p.text('p_reference', input.reference ?? ''),
    ];
    if (input.paidOn) params.push(p.date('p_paid_on', input.paidOn));

    const row = await this.sp.queryOne<{ record_payment: string }>(
      'public.record_payment',
      params,
    );
    if (!row) throw new Error('record_payment unexpectedly returned no row');
    return row.record_payment;
  }

  getPaymentById(id: string): Promise<PaymentRow | undefined> {
    return this.sp.selectOne<PaymentRow>(
      `select ${PAYMENT_COLUMNS} from public.payments where id = $1`,
      [id],
    );
  }

  listPayments(billingAccountId: string): Promise<PaymentRow[]> {
    return this.sp.selectMany<PaymentRow>(
      `select ${PAYMENT_COLUMNS} from public.payments where billing_account_id = $1 order by paid_on desc`,
      [billingAccountId],
    );
  }

  /** Caller must run this and {@link allocateCreditNote} inside the same `UnitOfWork` — the oversettlement check is a deferred constraint trigger, validated once at COMMIT. */
  async createCreditNote(input: {
    billingAccountId: string;
    amountCents: number;
    reason: string;
    issuedBy: string;
  }): Promise<string> {
    const result = await this.sp.executeRaw<{ id: string }>(
      `insert into public.credit_notes (billing_account_id, amount_cents, reason, issued_by)
       values ($1, $2, $3, $4)
       returning id`,
      [input.billingAccountId, input.amountCents, input.reason, input.issuedBy],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row.id;
  }

  async allocateCreditNote(
    creditNoteId: string,
    invoiceId: string,
    amountCents: number,
  ): Promise<void> {
    await this.sp.executeRaw(
      `insert into public.credit_note_allocations (credit_note_id, invoice_id, amount_cents)
       values ($1, $2, $3)`,
      [creditNoteId, invoiceId, amountCents],
    );
  }

  getCreditNoteById(id: string): Promise<CreditNoteRow | undefined> {
    return this.sp.selectOne<CreditNoteRow>(
      `select ${CREDIT_NOTE_COLUMNS} from public.credit_notes where id = $1`,
      [id],
    );
  }

  getOutstanding(): Promise<OutstandingFeeRow[]> {
    return this.sp.selectMany<OutstandingFeeRow>(
      `select billing_account_id, guardian_id, guardian_name, open_invoices, outstanding_cents, max_days_overdue
       from public.v_outstanding_fees
       order by outstanding_cents desc`,
    );
  }
}
