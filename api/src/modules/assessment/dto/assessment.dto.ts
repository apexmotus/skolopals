import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class AssessmentScoreDto {
  @ApiProperty() domainCode!: string;
  @ApiPropertyOptional() rawScore?: number;
  @ApiPropertyOptional() maxScore?: number;
  @ApiPropertyOptional() achievementLevelCode?: number;
  @ApiPropertyOptional() comment?: string;
  @ApiPropertyOptional({ description: 'Derived by the database from raw/max; never set by the client.' })
  percent?: number;
}

export class AssessmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty() assessmentTypeCode!: string;
  @ApiPropertyOptional() subjectCode?: string;
  @ApiProperty() gradeCode!: string;
  @ApiPropertyOptional() termId?: string;
  @ApiPropertyOptional() administeredBy?: string;
  @ApiProperty() assessedOn!: string;
  @ApiPropertyOptional() overallLevelCode?: number;
  @ApiProperty() notes!: string;
  @ApiProperty({ type: AssessmentScoreDto, isArray: true }) scores!: AssessmentScoreDto[];
}

export class RecordAssessmentScoreDto {
  @ApiProperty() @IsString() domainCode!: string;
  @ApiProperty() @IsNumber() @Min(0) rawScore!: number;
  @ApiProperty() @IsNumber() @Min(0.01) maxScore!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class RecordAssessmentDto {
  @ApiProperty() @IsString() assessmentTypeCode!: string;
  @ApiProperty() @IsString() gradeCode!: string;
  @ApiProperty({ example: '2026-11-07' }) @IsDateString() assessedOn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subjectCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() termId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiProperty({
    type: [RecordAssessmentScoreDto],
    minItems: 1,
    description: 'A scoreless assessment is not a partial record, it is useless — at least one domain score is required.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecordAssessmentScoreDto)
  scores!: RecordAssessmentScoreDto[];
}
