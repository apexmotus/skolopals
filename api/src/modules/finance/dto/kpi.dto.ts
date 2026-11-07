import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MonthlyRevenueDto {
  @ApiProperty() month!: string;
  @ApiProperty({ description: 'ZAR cents.' }) invoicedCents!: number;
  @ApiProperty({ description: 'ZAR cents.' }) collectedCents!: number;
}

export class MonthlyExpensesDto {
  @ApiProperty() month!: string;
  @ApiProperty({ description: 'ZAR cents.' }) expenseCents!: number;
}

export class OperatingSurplusDto {
  @ApiProperty() month!: string;
  @ApiProperty({ description: 'ZAR cents.' }) invoicedCents!: number;
  @ApiProperty({ description: 'ZAR cents.' }) collectedCents!: number;
  @ApiProperty({ description: 'ZAR cents.' }) expenseCents!: number;
  @ApiProperty({ description: 'ZAR cents. Cash collected minus expenses — never invoiced minus expenses.' })
  surplusCents!: number;
}

export class RevenuePerLearnerDto {
  @ApiProperty() month!: string;
  @ApiProperty() learnersBilled!: number;
  @ApiProperty({ description: 'ZAR cents.' }) invoicedCents!: number;
  @ApiPropertyOptional({ description: 'ZAR cents.' }) avgCentsPerLearner?: number;
}

export class AttendanceRateDto {
  @ApiProperty() month!: string;
  @ApiProperty() sessionsRecorded!: number;
  @ApiProperty() attended!: number;
  @ApiPropertyOptional() attendanceRatePct?: number;
}

export class AssessmentImprovementDto {
  @ApiProperty() learnerId!: string;
  @ApiProperty() domainCode!: string;
  @ApiPropertyOptional() initialPct?: number;
  @ApiPropertyOptional() latestPct?: number;
  @ApiPropertyOptional() changePct?: number;
}

export class LearnerCountsDto {
  @ApiProperty() month!: string;
  @ApiProperty() activeLearners!: number;
  @ApiProperty() newLearners!: number;
  @ApiProperty() departedLearners!: number;
}

export class LearnerRetentionDto {
  @ApiProperty() month!: string;
  @ApiProperty() activeLearners!: number;
  @ApiProperty() newLearners!: number;
  @ApiProperty() departedLearners!: number;
  @ApiPropertyOptional() retentionPct?: number;
}

export class EnquiryFunnelDto {
  @ApiProperty() month!: string;
  @ApiProperty() source!: string;
  @ApiProperty() enquiries!: number;
  @ApiProperty() converted!: number;
  @ApiPropertyOptional() conversionPct?: number;
}

export class TutorSessionLoadDto {
  @ApiProperty() tutorId!: string;
  @ApiProperty() month!: string;
  @ApiProperty() sessions!: number;
  @ApiProperty({ description: 'Hours actually taught.' }) hours!: number;
}

export class BreakEvenDto {
  @ApiProperty() month!: string;
  @ApiProperty({ description: 'ZAR cents.' }) expenseCents!: number;
  @ApiPropertyOptional({ description: 'ZAR cents.' }) avgCentsPerLearner?: number;
  @ApiPropertyOptional() learnersNeededToBreakEven?: number;
  @ApiPropertyOptional() activeLearners?: number;
}
