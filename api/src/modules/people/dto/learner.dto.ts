import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const LEARNER_STATUSES = ['prospective', 'active', 'paused', 'left'] as const;

export class LearnerDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() profileId?: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() dateOfBirth!: string;
  @ApiProperty() gradeCode!: string;
  @ApiProperty() schoolName!: string;
  @ApiPropertyOptional() homeLanguageCode?: string;
  @ApiProperty({ enum: LEARNER_STATUSES }) status!: string;
  @ApiProperty() joinedOn!: string;
  @ApiPropertyOptional() leftOn?: string;
}

export class CreateLearnerDto {
  @ApiProperty() @IsString() @MaxLength(200) fullName!: string;

  @ApiProperty({ example: '2013-04-02' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty() @IsString() gradeCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  homeLanguageCode?: string;
}

export class UpdateLearnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  homeLanguageCode?: string;

  @ApiPropertyOptional({ enum: LEARNER_STATUSES })
  @IsOptional()
  @IsIn(LEARNER_STATUSES)
  status?: string;

  @ApiPropertyOptional({
    description:
      'Required when status is set to "left"; must stay unset otherwise.',
  })
  @IsOptional()
  @IsDateString()
  leftOn?: string;
}

export class ListLearnersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() gradeCode?: string;

  @ApiPropertyOptional({ enum: LEARNER_STATUSES })
  @IsOptional()
  @IsIn(LEARNER_STATUSES)
  status?: string;
}
