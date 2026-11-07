import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/** Filters every KPI view's `month` column — any day within the first/last month to include. */
export class KpiRangeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class TutorSessionLoadQueryDto extends KpiRangeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tutorId?: string;
}
