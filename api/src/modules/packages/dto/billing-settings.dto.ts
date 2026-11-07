import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class BillingSettingsDto {
  @ApiProperty() id!: string;
  @ApiProperty() invoicePrefix!: string;
  @ApiProperty({ minimum: 1, maximum: 28 }) issueDay!: number;
  @ApiProperty({ minimum: 1, maximum: 28 }) dueDay!: number;
  @ApiProperty() graceDays!: number;
  @ApiProperty({ description: 'ZAR cents.' }) lateFeeCents!: number;
  @ApiProperty() effectiveFrom!: string;
  @ApiPropertyOptional() effectiveTo?: string;
}

export class CreateBillingSettingsDto {
  @ApiPropertyOptional({ default: 'SKP' })
  @IsOptional()
  invoicePrefix?: string;

  @ApiProperty({ minimum: 1, maximum: 28 })
  @IsInt()
  @Min(1)
  @Max(28)
  issueDay!: number;

  @ApiProperty({ minimum: 1, maximum: 28 })
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  graceDays!: number;

  @ApiProperty({ minimum: 0, description: 'ZAR cents.' })
  @IsInt()
  @Min(0)
  lateFeeCents!: number;

  @ApiProperty() @IsDateString() effectiveFrom!: string;
}
