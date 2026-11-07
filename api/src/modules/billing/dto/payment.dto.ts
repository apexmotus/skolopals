import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const PAYMENT_METHODS = ['eft', 'cash', 'card_offline', 'other'] as const;

export class PaymentDto {
  @ApiProperty() id!: string;
  @ApiProperty() billingAccountId!: string;
  @ApiProperty() paidOn!: string;
  @ApiProperty({ description: 'ZAR cents.' }) amountCents!: number;
  @ApiProperty({ enum: PAYMENT_METHODS }) method!: string;
  @ApiProperty() reference!: string;
  @ApiPropertyOptional() recordedBy?: string;
  @ApiProperty() createdAt!: Date;
}

export class RecordPaymentDto {
  @ApiProperty({ minimum: 1, description: 'ZAR cents.' })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  method!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Defaults to today.' })
  @IsOptional()
  @IsDateString()
  paidOn?: string;
}
