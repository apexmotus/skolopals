import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export const PROGRAMME_TYPES = ['holiday', 'saturday', 'exam_prep'] as const;
export const PROGRAMME_DELIVERY_MODES = ['in_centre', 'online', 'hybrid'] as const;

export class ProgrammeDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: PROGRAMME_TYPES }) programmeType!: string;
  @ApiProperty() startsOn!: string;
  @ApiProperty() endsOn!: string;
  @ApiProperty() capacity!: number;
  @ApiProperty() priceCents!: number;
  @ApiProperty({ enum: PROGRAMME_DELIVERY_MODES }) deliveryMode!: string;
  @ApiPropertyOptional() roomId?: string;
  @ApiProperty() isPublished!: boolean;
}

export class CreateProgrammeDto {
  @ApiProperty() @IsString() @MaxLength(200) name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: PROGRAMME_TYPES })
  @IsIn(PROGRAMME_TYPES)
  programmeType!: string;

  @ApiProperty() @IsDateString() startsOn!: string;
  @ApiProperty() @IsDateString() endsOn!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  priceCents!: number;

  @ApiProperty({ enum: PROGRAMME_DELIVERY_MODES })
  @IsIn(PROGRAMME_DELIVERY_MODES)
  deliveryMode!: string;

  @ApiPropertyOptional({
    description: 'Required unless deliveryMode is "online" — enforced by a DB CHECK constraint.',
  })
  @IsOptional()
  @IsUUID()
  roomId?: string;
}

export class UpdateProgrammeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: PROGRAMME_TYPES })
  @IsOptional()
  @IsIn(PROGRAMME_TYPES)
  programmeType?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() startsOn?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsOn?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @ApiPropertyOptional({ enum: PROGRAMME_DELIVERY_MODES })
  @IsOptional()
  @IsIn(PROGRAMME_DELIVERY_MODES)
  deliveryMode?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() roomId?: string;

  @ApiPropertyOptional({ description: 'The publish toggle.' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
