import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class ExpenseCategoryDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ description: 'ZAR cents. Monthly planning budget, for variance reporting.' })
  budgetCents?: number;
  @ApiProperty() sortOrder!: number;
}

export class CreateExpenseCategoryDto {
  @ApiProperty() @IsString() @MaxLength(50) code!: string;
  @ApiProperty() @IsString() @MaxLength(100) name!: string;

  @ApiPropertyOptional({ minimum: 0, description: 'ZAR cents.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetCents?: number;

  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}

export class ExpenseDto {
  @ApiProperty() id!: string;
  @ApiProperty() categoryCode!: string;
  @ApiProperty() incurredOn!: string;
  @ApiProperty({ description: 'ZAR cents.' }) amountCents!: number;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() recordedBy?: string;
  @ApiProperty() createdAt!: Date;
}

export class RecordExpenseDto {
  @ApiProperty() @IsString() categoryCode!: string;

  @ApiProperty() @IsDateString() incurredOn!: string;

  @ApiProperty({ minimum: 1, description: 'ZAR cents.' })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class ListExpensesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryCode?: string;
}
