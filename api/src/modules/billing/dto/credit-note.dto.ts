import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreditNoteDto {
  @ApiProperty() id!: string;
  @ApiProperty() billingAccountId!: string;
  @ApiProperty() issuedOn!: string;
  @ApiProperty({ description: 'ZAR cents.' }) amountCents!: number;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional() issuedBy?: string;
}

/**
 * `invoiceId` is required, not optional: there is no Postgres function (or
 * app-level rule) that auto-allocates an unallocated credit note the way
 * `record_payment` auto-allocates a payment oldest-first — a credit note
 * with no allocation would sit on the account statement but never reduce
 * any invoice's balance. Requiring the target invoice up front is the
 * honest version of this write, not an invented feature.
 */
export class IssueCreditNoteDto {
  @ApiProperty() @IsUUID() invoiceId!: string;

  @ApiProperty({ minimum: 1, description: 'ZAR cents.' })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiProperty() @IsString() @MaxLength(500) reason!: string;
}
