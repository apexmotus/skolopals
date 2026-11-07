import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceLineDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: ['package', 'addon', 'registration', 'programme', 'late_fee', 'discount', 'adjustment'],
  })
  lineType!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() enrolmentId?: string;
  @ApiPropertyOptional() programmeEnrolmentId?: string;
  @ApiPropertyOptional() packageCode?: string;
  @ApiPropertyOptional() learnerId?: string;
  @ApiProperty() quantity!: number;
  @ApiProperty({ description: 'ZAR cents.' }) unitAmountCents!: number;
  @ApiProperty({ description: 'ZAR cents.' }) lineTotalCents!: number;
  @ApiPropertyOptional({ description: 'The month this line covers, null for a once-off line.' })
  periodMonth?: string;
}

export class InvoiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() billingAccountId!: string;
  @ApiProperty() invoiceNumber!: string;
  @ApiPropertyOptional() periodStart?: string;
  @ApiPropertyOptional() periodEnd?: string;
  @ApiProperty() issuedOn!: string;
  @ApiProperty() dueOn!: string;
  @ApiProperty({
    enum: ['draft', 'issued', 'cancelled', 'written_off'],
    description: 'Workflow state only — never the derived payment state.',
  })
  status!: string;
  @ApiProperty() notes!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ description: 'ZAR cents. Sum of this invoice\'s lines.' }) totalCents!: number;
  @ApiProperty({ description: 'ZAR cents. Payments plus credit notes allocated to this invoice.' })
  settledCents!: number;
  @ApiProperty({ description: 'ZAR cents. totalCents minus settledCents.' }) balanceCents!: number;
  @ApiProperty({
    enum: ['draft', 'cancelled', 'written_off', 'paid', 'part_paid', 'overdue', 'unpaid'],
    description: 'Derived from allocations, never stored — see `v_invoice_status`.',
  })
  paymentState!: string;
  @ApiProperty() daysOverdue!: number;
  @ApiProperty({ type: InvoiceLineDto, isArray: true }) lines!: InvoiceLineDto[];
}

export class RunMonthlyInvoicesResultItemDto {
  @ApiProperty() invoiceId!: string;
  @ApiProperty() billingAccountId!: string;
  @ApiProperty({ description: 'ZAR cents. Running total for this invoice after this run.' })
  totalCents!: number;
}
