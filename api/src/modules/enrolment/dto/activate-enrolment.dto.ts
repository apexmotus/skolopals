import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ActivateEnrolmentDto {
  @ApiProperty() @IsUUID() assignedTutorId!: string;

  @ApiPropertyOptional({ description: 'Defaults to today.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      'ZAR cents. Admin discretion for the first month; null = full package price.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  firstMonthCents?: number;

  @ApiPropertyOptional({
    description:
      'Required when firstMonthCents is set — makes the discretion auditable.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ActivateEnrolmentResultDto {
  @ApiProperty() enrolmentId!: string;
  @ApiPropertyOptional({
    description:
      'Unset if this learner was already charged a registration fee before.',
  })
  registrationInvoiceId?: string;
}
