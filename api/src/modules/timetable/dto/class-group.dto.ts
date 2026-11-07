import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const DELIVERY_MODES = ['in_centre', 'online', 'hybrid'] as const;

export class ClassGroupDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() subjectCode!: string;
  @ApiProperty() languageCode!: string;
  @ApiProperty() tutorId!: string;
  @ApiProperty() termId!: string;
  @ApiProperty({ enum: DELIVERY_MODES }) deliveryMode!: string;
  @ApiPropertyOptional() roomId?: string;
  @ApiProperty() capacity!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({
    type: [String],
    description: 'Grades this class covers (a combined class may cover more than one).',
  })
  gradeCodes!: string[];
}

export class ListClassGroupsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() termId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() tutorId?: string;
}

export class CreateClassGroupDto {
  @ApiProperty() @IsString() @MaxLength(200) name!: string;
  @ApiProperty() @IsString() subjectCode!: string;
  @ApiProperty() @IsString() languageCode!: string;
  @ApiProperty() @IsUUID() tutorId!: string;
  @ApiProperty() @IsUUID() termId!: string;

  @ApiProperty({ enum: DELIVERY_MODES })
  @IsIn(DELIVERY_MODES)
  deliveryMode!: string;

  @ApiPropertyOptional({
    description: 'Required unless deliveryMode is "online" — enforced by a DB CHECK constraint.',
  })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiProperty({ minimum: 1, maximum: 30 })
  @IsInt()
  @Min(1)
  @Max(30)
  capacity!: number;

  @ApiProperty({
    type: [String],
    minItems: 1,
    description:
      'Every grade the class covers. The assigned tutor must be a recorded competency match for each one, in this subject and language — checked before the class is created.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  gradeCodes!: string[];
}

export class UpdateClassGroupDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subjectCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() languageCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() tutorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() termId?: string;

  @ApiPropertyOptional({ enum: DELIVERY_MODES })
  @IsOptional()
  @IsIn(DELIVERY_MODES)
  deliveryMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [String],
    minItems: 1,
    description: 'Replaces the full grade-coverage set.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  gradeCodes?: string[];
}
