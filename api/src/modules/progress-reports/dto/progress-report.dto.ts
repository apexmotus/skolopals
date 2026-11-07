import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ProgressReportSubjectDto {
  @ApiProperty() subjectCode!: string;
  @ApiPropertyOptional() achievementLevelCode?: number;
  @ApiProperty() strengths!: string;
  @ApiProperty() areasForImprovement!: string;
  @ApiProperty() recommendedIntervention!: string;
}

export class ReportAcknowledgementDto {
  @ApiProperty() guardianId!: string;
  @ApiProperty() acknowledgedAt!: string;
  @ApiProperty() comment!: string;
}

export class ProgressReportDto {
  @ApiProperty() id!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty() termId!: string;
  @ApiPropertyOptional() tutorId?: string;
  @ApiProperty() summary!: string;
  @ApiProperty() attendanceNote!: string;
  @ApiPropertyOptional() issuedOn?: string;
  @ApiPropertyOptional({ description: 'Null until published; once set, never cleared.' })
  publishedAt?: string;
  @ApiProperty({ type: ProgressReportSubjectDto, isArray: true }) subjects!: ProgressReportSubjectDto[];
  @ApiProperty({ type: ReportAcknowledgementDto, isArray: true }) acknowledgements!: ReportAcknowledgementDto[];
}

export class SaveProgressReportSubjectDto {
  @ApiProperty() @IsString() subjectCode!: string;
  @ApiPropertyOptional() @IsOptional() achievementLevelCode?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() strengths?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areasForImprovement?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recommendedIntervention?: string;
}

export class SaveProgressReportDto {
  @ApiPropertyOptional() @IsOptional() @IsString() summary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() attendanceNote?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'One-way: once a report is published it is never silently unpublished by a later save with publish=false.',
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiProperty({
    type: [SaveProgressReportSubjectDto],
    minItems: 1,
    description: 'A report must cover at least one subject.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveProgressReportSubjectDto)
  subjects!: SaveProgressReportSubjectDto[];
}

export class AcknowledgeReportDto {
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}
