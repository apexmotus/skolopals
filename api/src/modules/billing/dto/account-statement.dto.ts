import { ApiProperty } from '@nestjs/swagger';

export class AccountStatementEntryDto {
  @ApiProperty() billingAccountId!: string;
  @ApiProperty() guardianId!: string;
  @ApiProperty({ enum: ['invoice', 'payment', 'credit'] }) entryType!: string;
  @ApiProperty() reference!: string;
  @ApiProperty() entryDate!: string;
  @ApiProperty({ description: 'ZAR cents.' }) debitCents!: number;
  @ApiProperty({ description: 'ZAR cents.' }) creditCents!: number;
}
