import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

const EMPLOYMENT_TYPES = ['salaried', 'sessional'] as const;

export class TutorDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() headline!: string;
  @ApiProperty() bio!: string;
  @ApiPropertyOptional() photoUrl?: string;
  @ApiProperty({ enum: EMPLOYMENT_TYPES }) employmentType!: string;
  @ApiProperty() status!: string;

  @ApiPropertyOptional() rating?: number;
  @ApiPropertyOptional() reviewCount?: number;
}

export class ListPublicTutorsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only tutors competent to teach this subject code' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Only tutors competent to teach this grade code' })
  @IsOptional()
  @IsString()
  grade?: string;

  @ApiPropertyOptional({ description: 'Only tutors who speak this language code' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class CreateTutorDto {
  @ApiProperty({
    description:
      'Must already have a signed-up account (BR-23) — the function raises NOT_FOUND otherwise.',
  })
  @IsEmail()
  email!: string;

  @ApiProperty() @IsString() @MaxLength(100) slug!: string;

  @ApiProperty({ enum: EMPLOYMENT_TYPES })
  @IsIn(EMPLOYMENT_TYPES)
  employmentType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;
}

export class UpdateMyTutorProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  photoUrl?: string;
}
