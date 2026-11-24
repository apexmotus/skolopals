import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PaymentSubmissionDto {
  @ApiProperty() submissionId!: string;
  @ApiProperty({ description: 'May differ from the invoice asked for: an offer from an earlier month is re-quoted first.' })
  invoiceId!: string;
  @ApiProperty({ enum: ['awaiting_proof', 'submitted'] }) status!: string;
  @ApiProperty() requoted!: boolean;
}

export class AttachProofDto {
  @ApiProperty({ description: 'The path returned by POST /uploads/confirm (purpose payment_proof).' })
  @IsString()
  @MaxLength(300)
  @Matches(/^staging\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$/)
  path!: string;

  @ApiProperty({ enum: ['application/pdf', 'image/jpeg', 'image/png'] })
  @IsIn(['application/pdf', 'image/jpeg', 'image/png'])
  mimeType!: string;

  @ApiPropertyOptional({ description: 'ZAR cents the parent says they paid. Defaults to the invoice total in the UI.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  claimedAmountCents?: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString() claimedPaidOn?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) payerReference?: string;
}

export class ProofLinkDto {
  @ApiProperty({ description: 'Signed URL, valid for 60 seconds.' }) url!: string;
  @ApiProperty() mime!: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'ZAR cents actually received.' })
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountCents!: number;

  @ApiPropertyOptional({ description: 'Defaults to today.' }) @IsOptional() @IsDateString() paidOn?: string;

  @ApiPropertyOptional({ description: 'Bank reference; defaults to the one the parent typed.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class PlacementItemDto {
  @ApiProperty() subjectCode!: string;
  @ApiProperty() subjectName!: string;
  @ApiPropertyOptional() classGroupId?: string;
  @ApiPropertyOptional() className?: string;
}

export class PlacementDto {
  @ApiProperty({ type: PlacementItemDto, isArray: true }) placed!: PlacementItemDto[];
  @ApiProperty({ type: PlacementItemDto, isArray: true }) unplaced!: PlacementItemDto[];
}

export class VerifyPaymentResultDto {
  @ApiProperty() paymentId!: string;
  @ApiProperty({ description: 'True when this settled an offer invoice and the learner is now enrolled.' })
  activated!: boolean;
  @ApiPropertyOptional({ type: PlacementDto }) placement?: PlacementDto;
  @ApiPropertyOptional({ description: 'Next month\'s invoice, when its run date had already passed (D9).' })
  nextInvoiceId?: string;
}

export class RejectPaymentDto {
  @ApiProperty({ example: 'Amount does not match' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  reason!: string;
}
