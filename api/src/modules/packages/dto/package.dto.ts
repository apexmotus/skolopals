import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

const SERVICE_TYPES = [
  'group',
  'homework',
  'one_on_one',
  'academic_plus',
  'holiday_programme',
  'registration',
] as const;
const BILLING_PERIODS = [
  'monthly',
  'once_off',
  'per_hour',
  'per_block',
  'per_programme',
] as const;

export class PackageDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: SERVICE_TYPES }) serviceType!: string;
  @ApiProperty({ enum: BILLING_PERIODS }) billingPeriod!: string;
  @ApiPropertyOptional({
    description: 'null = all subjects, or subjects do not apply.',
  })
  subjectAllowance?: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() sortOrder!: number;
}

export class CreatePackageDto {
  @ApiProperty() @IsString() @MaxLength(50) code!: string;
  @ApiProperty() @IsString() @MaxLength(200) name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: SERVICE_TYPES })
  @IsIn(SERVICE_TYPES)
  serviceType!: string;
  @ApiProperty({ enum: BILLING_PERIODS })
  @IsIn(BILLING_PERIODS)
  billingPeriod!: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  subjectAllowance?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty() @IsInt() sortOrder!: number;
}
