import { ApiProperty } from '@nestjs/swagger';

export class OutstandingFeeDto {
  @ApiProperty() billingAccountId!: string;
  @ApiProperty() guardianId!: string;
  @ApiProperty() guardianName!: string;
  @ApiProperty() openInvoices!: number;
  @ApiProperty({ description: 'ZAR cents.' }) outstandingCents!: number;
  @ApiProperty() maxDaysOverdue!: number;
}
