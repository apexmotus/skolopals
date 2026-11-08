import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import { BillingMapper } from './billing.mapper.js';
import { BillingRepository } from './billing.repository.js';
import type { AccountStatementEntryDto } from './dto/account-statement.dto.js';
import type { BillingAccountDto } from './dto/billing-account.dto.js';
import { ApplyLateFeesDto, ApplyLateFeesResultDto, RunMonthlyInvoicesDto } from './dto/billing-run.dto.js';
import type { CreditNoteDto, IssueCreditNoteDto } from './dto/credit-note.dto.js';
import type { InvoiceDto, RunMonthlyInvoicesResultItemDto } from './dto/invoice.dto.js';
import type { OutstandingFeeDto } from './dto/outstanding-fee.dto.js';
import type { PaymentDto, RecordPaymentDto } from './dto/payment.dto.js';

/**
 * No caching anywhere in this module (`03-endpoints-and-business-rules.md`
 * §billing: "Cacheable: none — financial data must always be current; a
 * stale balance is a support ticket"). Row-level ownership ("owner Guardian,
 * Admin") is enforced entirely by RLS — this module never re-checks
 * `guardian_id = actor.id` itself; a non-owner's query simply comes back
 * empty/undefined, surfaced here as a 404, same convention as every prior
 * module. The role gate on every single endpoint is still explicit
 * (`@Roles(...)` in the controller, never omitted) because the plan's own
 * acceptance check requires a Tutor JWT to get a **403** on every billing
 * endpoint, not a 404 — RLS alone would only ever produce the latter.
 */
@Injectable()
export class BillingManager {
  constructor(
    private readonly repo: BillingRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async getMine(actor: AuthUser): Promise<BillingAccountDto> {
    const row = await this.repo.getBillingAccountByGuardian(actor.id);
    if (!row) throw new NotFoundException('No billing account found for this guardian.');
    return BillingMapper.accountToDto(row);
  }

  async getById(id: string): Promise<BillingAccountDto> {
    const row = await this.repo.getBillingAccountById(id);
    if (!row) throw new NotFoundException('Billing account not found.');
    return BillingMapper.accountToDto(row);
  }

  /** Confirms the account is visible to this actor first — an empty statement is otherwise ambiguous between "no history yet" and "not yours". */
  async getStatement(id: string): Promise<AccountStatementEntryDto[]> {
    const account = await this.repo.getBillingAccountById(id);
    if (!account) throw new NotFoundException('Billing account not found.');
    const rows = await this.repo.getStatement(id);
    return rows.map((row) => BillingMapper.statementEntryToDto(row));
  }

  async getInvoiceById(id: string): Promise<InvoiceDto> {
    const row = await this.repo.getInvoiceById(id);
    if (!row) throw new NotFoundException('Invoice not found.');
    return BillingMapper.invoiceToDto(row);
  }

  /** Same ambiguous-empty-list reasoning as {@link getStatement}. */
  async listInvoices(billingAccountId: string): Promise<InvoiceDto[]> {
    const account = await this.repo.getBillingAccountById(billingAccountId);
    if (!account) throw new NotFoundException('Billing account not found.');
    const rows = await this.repo.listInvoices(billingAccountId);
    return rows.map((row) => BillingMapper.invoiceToDto(row));
  }

  async runMonthly(dto: RunMonthlyInvoicesDto): Promise<RunMonthlyInvoicesResultItemDto[]> {
    const rows = await this.repo.runMonthly(dto.period);
    return rows.map((row) => BillingMapper.runMonthlyResultToDto(row));
  }

  async applyLateFees(dto: ApplyLateFeesDto): Promise<ApplyLateFeesResultDto> {
    const lateFeeCount = await this.repo.applyLateFees(dto.onDate);
    return { lateFeeCount };
  }

  async recordPayment(billingAccountId: string, dto: RecordPaymentDto): Promise<PaymentDto> {
    const paymentId = await this.repo.recordPayment({
      billingAccountId,
      amountCents: dto.amountCents,
      method: dto.method,
      reference: dto.reference,
      paidOn: dto.paidOn,
    });
    const row = await this.repo.getPaymentById(paymentId);
    if (!row) throw new Error('Freshly recorded payment could not be re-read');
    return BillingMapper.paymentToDto(row);
  }

  /** Same ambiguous-empty-list reasoning as {@link getStatement}. */
  async listPayments(billingAccountId: string): Promise<PaymentDto[]> {
    const account = await this.repo.getBillingAccountById(billingAccountId);
    if (!account) throw new NotFoundException('Billing account not found.');
    const rows = await this.repo.listPayments(billingAccountId);
    return rows.map((row) => BillingMapper.paymentToDto(row));
  }

  /**
   * `dto.invoiceId` must belong to `billingAccountId` — checked via the
   * already-built, RLS-protected {@link BillingRepository.getInvoiceById}
   * rather than a second bespoke query. Both writes run inside one
   * `UnitOfWork`: the "not oversettled" check on `credit_note_allocations`
   * is a deferred constraint trigger that only fires at COMMIT, so a
   * credit note left unallocated by a failed second insert must never
   * survive on its own.
   */
  async issueCreditNote(
    billingAccountId: string,
    dto: IssueCreditNoteDto,
    actor: AuthUser,
  ): Promise<CreditNoteDto> {
    const invoice = await this.repo.getInvoiceById(dto.invoiceId);
    if (invoice?.billing_account_id !== billingAccountId) {
      throw new NotFoundException('Invoice not found for this billing account.');
    }

    const creditNoteId = await this.uow.run(async () => {
      const id = await this.repo.createCreditNote({
        billingAccountId,
        amountCents: dto.amountCents,
        reason: dto.reason,
        issuedBy: actor.id,
      });
      await this.repo.allocateCreditNote(id, dto.invoiceId, dto.amountCents);
      return id;
    });

    const row = await this.repo.getCreditNoteById(creditNoteId);
    if (!row) throw new Error('Freshly issued credit note could not be re-read');
    return BillingMapper.creditNoteToDto(row);
  }

  async getOutstanding(): Promise<OutstandingFeeDto[]> {
    const rows = await this.repo.getOutstanding();
    return rows.map((row) => BillingMapper.outstandingFeeToDto(row));
  }
}
