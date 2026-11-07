import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const QUALIFICATION_TYPES = [
  'degree',
  'diploma',
  'certificate',
  'other',
] as const;

export class TutorQualificationDto {
  @ApiProperty() id!: string;
  @ApiProperty() tutorId!: string;
  @ApiProperty({ enum: QUALIFICATION_TYPES }) qualificationType!: string;
  @ApiProperty() title!: string;
  @ApiProperty() institution!: string;
  @ApiPropertyOptional() yearAwarded?: number;
  @ApiPropertyOptional() verifiedAt?: string;
}

export class AddQualificationDto {
  @ApiProperty({ enum: QUALIFICATION_TYPES })
  @IsIn(QUALIFICATION_TYPES)
  qualificationType!: string;

  @ApiProperty() @IsString() @MaxLength(200) title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  institution?: string;

  @ApiPropertyOptional({ minimum: 1950, maximum: 2100 })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  yearAwarded?: number;
}
