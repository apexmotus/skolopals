import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class PackagePriceDto {
  @ApiProperty() id!: string;
  @ApiProperty() packageCode!: string;
  @ApiProperty({ description: 'ZAR cents.' }) amountCents!: number;
  @ApiProperty() effectiveFrom!: string;
  @ApiPropertyOptional() effectiveTo?: string;
}

export class SetPackagePriceDto {
  @ApiProperty({ minimum: 0, description: 'ZAR cents.' })
  @IsInt()
  @Min(0)
  amountCents!: number;

  @ApiProperty() @IsDateString() effectiveFrom!: string;
}

export class GetPriceOnQueryDto {
  @ApiPropertyOptional({ description: 'Defaults to today.' })
  @IsOptional()
  @IsDateString()
  on?: string;
}
