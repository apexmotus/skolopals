import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AccountStatementEntryDto } from './dto/account-statement.dto.js';
import { BillingAccountDto } from './dto/billing-account.dto.js';
import {
  ApplyLateFeesDto,
  ApplyLateFeesResultDto,
  RunMonthlyInvoicesDto,
} from './dto/billing-run.dto.js';
import { CreditNoteDto, IssueCreditNoteDto } from './dto/credit-note.dto.js';
import { InvoiceDto, RunMonthlyInvoicesResultItemDto } from './dto/invoice.dto.js';
import { OutstandingFeeDto } from './dto/outstanding-fee.dto.js';
import { PaymentDto, RecordPaymentDto } from './dto/payment.dto.js';
import { BillingManager } from './billing.manager.js';

/** Tutors have zero access to this entire module — every route carries an explicit `@Roles(...)` that never includes `'tutor'`, so `RolesGuard` returns 403 before any RLS-filtered query runs. */
@ApiTags('billing')
@ApiBearerAuth()
@Controller()
export class BillingController {
  constructor(private readonly manager: BillingManager) {}

  @Get('billing-accounts/me')
  @Roles('parent')
  @ApiOperation({ summary: "The caller's own billing account" })
  @ApiOkResponse({ type: BillingAccountDto })
  getMine(@CurrentUser() actor: AuthUser): Promise<BillingAccountDto> {
    return this.manager.getMine(actor);
  }

  @Get('billing-accounts/:id')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Get a billing account by id (its owning guardian, or admin)' })
  @ApiOkResponse({ type: BillingAccountDto })
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<BillingAccountDto> {
    return this.manager.getById(id);
  }

  @Get('billing-accounts/:id/statement')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Statement of account: invoices, payments and credits in date order' })
  @ApiOkResponse({ type: AccountStatementEntryDto, isArray: true })
  getStatement(@Param('id', ParseUUIDPipe) id: string): Promise<AccountStatementEntryDto[]> {
    return this.manager.getStatement(id);
  }

  @Get('invoices/:id')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Get an invoice, with its lines and derived payment state' })
  @ApiOkResponse({ type: InvoiceDto })
  getInvoiceById(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceDto> {
    return this.manager.getInvoiceById(id);
  }

  @Get('billing-accounts/:id/invoices')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: "List a billing account's invoices" })
  @ApiOkResponse({ type: InvoiceDto, isArray: true })
  listInvoices(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceDto[]> {
    return this.manager.listInvoices(id);
  }

  @Post('billing/run-monthly-invoices')
  @Roles('admin')
  @ApiOperation({ summary: 'Bill every active monthly enrolment for the target period' })
  @ApiOkResponse({ type: RunMonthlyInvoicesResultItemDto, isArray: true })
  runMonthly(@Body() dto: RunMonthlyInvoicesDto): Promise<RunMonthlyInvoicesResultItemDto[]> {
    return this.manager.runMonthly(dto);
  }

  @Post('billing/apply-late-fees')
  @Roles('admin')
  @ApiOperation({ summary: 'Charge a late fee on every overdue invoice past its grace period' })
  @ApiOkResponse({ type: ApplyLateFeesResultDto })
  applyLateFees(@Body() dto: ApplyLateFeesDto): Promise<ApplyLateFeesResultDto> {
    return this.manager.applyLateFees(dto);
  }

  @Post('billing-accounts/:id/payments')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a payment, allocated oldest-invoice-first' })
  @ApiCreatedResponse({ type: PaymentDto })
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<PaymentDto> {
    return this.manager.recordPayment(id, dto);
  }

  @Get('billing-accounts/:id/payments')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: "List a billing account's payments" })
  @ApiOkResponse({ type: PaymentDto, isArray: true })
  listPayments(@Param('id', ParseUUIDPipe) id: string): Promise<PaymentDto[]> {
    return this.manager.listPayments(id);
  }

  @Post('billing-accounts/:id/credit-notes')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue a credit note against one of this account\'s invoices' })
  @ApiCreatedResponse({ type: CreditNoteDto })
  issueCreditNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueCreditNoteDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<CreditNoteDto> {
    return this.manager.issueCreditNote(id, dto, actor);
  }

  @Get('admin/billing/outstanding')
  @Roles('admin')
  @ApiOperation({ summary: 'Every billing account with a positive outstanding balance' })
  @ApiOkResponse({ type: OutstandingFeeDto, isArray: true })
  getOutstanding(): Promise<OutstandingFeeDto[]> {
    return this.manager.getOutstanding();
  }
}
