import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class RunMonthlyInvoicesDto {
  @ApiPropertyOptional({
    description:
      'The month to bill, any day within it. Defaults to the first day of next calendar month.',
  })
  @IsOptional()
  @IsDateString()
  period?: string;
}

export class ApplyLateFeesDto {
  @ApiPropertyOptional({ description: 'Defaults to today.' })
  @IsOptional()
  @IsDateString()
  onDate?: string;
}

export class ApplyLateFeesResultDto {
  @ApiProperty() lateFeeCount!: number;
}
