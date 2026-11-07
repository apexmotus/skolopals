import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
} from 'class-validator';

export class TutorCompetencyDto {
  @ApiProperty() id!: string;
  @ApiProperty() tutorId!: string;
  @ApiProperty() subjectCode!: string;
  @ApiProperty() gradeCode!: string;
  @ApiProperty({ type: [String] }) mediaLanguageCodes!: string[];
}

export class SetCompetencyDto {
  @ApiProperty() @IsString() subjectCode!: string;
  @ApiProperty() @IsString() gradeCode!: string;

  @ApiProperty({
    type: [String],
    minItems: 1,
    description: 'At least one medium of instruction, ported-check enforced.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  mediaLanguageCodes!: string[];
}
