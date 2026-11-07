import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const EMPLOYMENT_TYPES = ['salaried', 'sessional'] as const;

export class TutorDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() headline!: string;
  @ApiProperty() bio!: string;
  @ApiPropertyOptional() photoUrl?: string;
  @ApiProperty({ enum: EMPLOYMENT_TYPES }) employmentType!: string;
  @ApiProperty() status!: string;

  /** Only populated on a single-tutor read (`getBySlug`/`getMyProfile`), never on the list, to avoid one rating query per row. */
  @ApiPropertyOptional() rating?: number;
  @ApiPropertyOptional() reviewCount?: number;
}

export class ListPublicTutorsQueryDto extends PaginationQueryDto {}

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
