import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class QuoteQueryDto {
  @ApiProperty() @IsString() @MaxLength(50) packageCode!: string;

  @ApiPropertyOptional({ description: 'Acceptance date to quote for. Defaults to today.' })
  @IsOptional()
  @IsDateString()
  on?: string;

  @ApiPropertyOptional({ description: 'Leave out the registration fee if this learner has already paid it.' })
  @IsOptional()
  @IsUUID()
  learnerId?: string;
}

/** What acceptance on `on` costs (SPEC §5.1). The offer invoice uses the same SQL, so it always matches. */
export class QuoteDto {
  @ApiProperty() on!: string;
  @ApiProperty() registrationCents!: number;
  @ApiPropertyOptional() monthlyCents?: number;
  @ApiProperty() tuitionCents!: number;
  @ApiProperty() daysCharged!: number;
  @ApiProperty() daysInMonth!: number;
  @ApiProperty() periodStart!: string;
  @ApiProperty() periodEnd!: string;
  @ApiProperty() totalCents!: number;
}

const STAGES = [
  'details',
  'assessment',
  'review',
  'payment',
  'proof',
  'verification',
  'activation',
  'needs_placement',
  'active',
  'paused',
  'ended',
  'declined',
] as const;

/** A row of `v_enrolment_progress` (SPEC §4.5). */
export class EnrolmentProgressDto {
  @ApiProperty() enrolmentId!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ enum: STAGES }) stage!: string;
  @ApiPropertyOptional() offerExpiresOn?: string;
  @ApiPropertyOptional() offerInvoiceId?: string;
  @ApiPropertyOptional() offerBalanceCents?: number;
  @ApiPropertyOptional() openSubmissionId?: string;
  @ApiPropertyOptional() submissionStatus?: string;
  @ApiPropertyOptional() declineReason?: string;
}

export class AcceptEnrolmentResultDto {
  @ApiProperty() invoiceId!: string;
  @ApiProperty() amountDueCents!: number;
  @ApiProperty({ description: 'The offer lapses after this date if unpaid (D14).' })
  offerExpiresOn!: string;
}

export class DeclineEnrolmentDto {
  @ApiProperty({ example: 'No class available for this grade/subject' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  reason!: string;

  @ApiPropertyOptional({ description: 'Optional note to the parent.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class ReportCardFiledDto {
  @ApiProperty() documentId!: string;
}
