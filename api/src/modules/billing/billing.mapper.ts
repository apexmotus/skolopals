import type { AccountStatementEntryDto } from './dto/account-statement.dto.js';
import type { BillingAccountDto } from './dto/billing-account.dto.js';
import type { CreditNoteDto } from './dto/credit-note.dto.js';
import type { InvoiceDto, InvoiceLineDto, RunMonthlyInvoicesResultItemDto } from './dto/invoice.dto.js';
import type { OutstandingFeeDto } from './dto/outstanding-fee.dto.js';
import type { PaymentDto } from './dto/payment.dto.js';
import type { AccountStatementRow } from './rows/account-statement.row.js';
import type { BillingAccountRow } from './rows/billing-account.row.js';
import type { CreditNoteRow } from './rows/credit-note.row.js';
import type { InvoiceLineRow, InvoiceRow, RunMonthlyInvoicesRow } from './rows/invoice.row.js';
import type { OutstandingFeeRow } from './rows/outstanding-fee.row.js';
import type { PaymentRow } from './rows/payment.row.js';

export class BillingMapper {
  static accountToDto(row: BillingAccountRow): BillingAccountDto {
    return {
      id: row.id,
      guardianId: row.guardian_id,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  static lineToDto(row: InvoiceLineRow): InvoiceLineDto {
    return {
      id: row.id,
      lineType: row.line_type,
      description: row.description,
      enrolmentId: row.enrolment_id ?? undefined,
      programmeEnrolmentId: row.programme_enrolment_id ?? undefined,
      packageCode: row.package_code ?? undefined,
      learnerId: row.learner_id ?? undefined,
      quantity: row.quantity,
      unitAmountCents: row.unit_amount_cents,
      lineTotalCents: row.line_total_cents,
      periodMonth: row.period_month ?? undefined,
    };
  }

  static invoiceToDto(row: InvoiceRow): InvoiceDto {
    return {
      id: row.id,
      billingAccountId: row.billing_account_id,
      invoiceNumber: row.invoice_number,
      periodStart: row.period_start ?? undefined,
      periodEnd: row.period_end ?? undefined,
      issuedOn: row.issued_on,
      dueOn: row.due_on,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      totalCents: Number(row.total_cents),
      settledCents: Number(row.settled_cents),
      balanceCents: Number(row.balance_cents),
      paymentState: row.payment_state,
      daysOverdue: row.days_overdue,
      lines: row.lines.map((line) => BillingMapper.lineToDto(line)),
    };
  }

  static runMonthlyResultToDto(row: RunMonthlyInvoicesRow): RunMonthlyInvoicesResultItemDto {
    return {
      invoiceId: row.invoice_id,
      billingAccountId: row.billing_account_id,
      totalCents: Number(row.total_cents),
    };
  }

  static paymentToDto(row: PaymentRow): PaymentDto {
    return {
      id: row.id,
      billingAccountId: row.billing_account_id,
      paidOn: row.paid_on,
      amountCents: row.amount_cents,
      method: row.method,
      reference: row.reference,
      recordedBy: row.recorded_by ?? undefined,
      createdAt: row.created_at,
    };
  }

  static creditNoteToDto(row: CreditNoteRow): CreditNoteDto {
    return {
      id: row.id,
      billingAccountId: row.billing_account_id,
      issuedOn: row.issued_on,
      amountCents: row.amount_cents,
      reason: row.reason,
      issuedBy: row.issued_by ?? undefined,
    };
  }

  static statementEntryToDto(row: AccountStatementRow): AccountStatementEntryDto {
    return {
      billingAccountId: row.billing_account_id,
      guardianId: row.guardian_id,
      entryType: row.entry_type,
      reference: row.reference,
      entryDate: row.entry_date,
      debitCents: Number(row.debit_cents),
      creditCents: row.credit_cents,
    };
  }

  static outstandingFeeToDto(row: OutstandingFeeRow): OutstandingFeeDto {
    return {
      billingAccountId: row.billing_account_id,
      guardianId: row.guardian_id,
      guardianName: row.guardian_name,
      openInvoices: Number(row.open_invoices),
      outstandingCents: Number(row.outstanding_cents),
      maxDaysOverdue: row.max_days_overdue,
    };
  }
}
