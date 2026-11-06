import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SubjectOfferingDto {
  @ApiProperty() subjectCode!: string;
  @ApiProperty() gradeCode!: string;
}

export class ListSubjectOfferingsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter to the subjects offered at this grade.',
  })
  @IsOptional()
  @IsString()
  gradeCode?: string;
}
