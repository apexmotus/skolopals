import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { SubmitSubjectDto } from './submit-enrolment.dto.js';

export class UpdateEnrolmentSubjectsDto {
  @ApiProperty({
    type: [SubmitSubjectDto],
    description:
      'Full replace — subject count must not exceed the package allowance.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitSubjectDto)
  subjects!: SubmitSubjectDto[];
}

export class EnrolmentSubjectDto {
  @ApiProperty() subjectCode!: string;
  @ApiProperty({ required: false }) preferredLanguageCode?: string;
}
