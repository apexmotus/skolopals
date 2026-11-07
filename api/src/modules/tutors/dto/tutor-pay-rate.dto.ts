import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';

const PAY_BASES = ['monthly_salary', 'per_session', 'per_hour'] as const;

export class TutorPayRateDto {
  @ApiProperty() id!: string;
  @ApiProperty() tutorId!: string;
  @ApiProperty({ enum: PAY_BASES }) payBasis!: string;
  @ApiProperty({ description: 'ZAR cents.' }) amountCents!: number;
  @ApiProperty() effectiveFrom!: string;
  @ApiPropertyOptional() effectiveTo?: string;
}

export class SetPayRateDto {
  @ApiProperty({ enum: PAY_BASES }) @IsIn(PAY_BASES) payBasis!: string;

  @ApiProperty({ minimum: 1, description: 'ZAR cents.' })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiPropertyOptional({ description: 'Defaults to today.' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}
