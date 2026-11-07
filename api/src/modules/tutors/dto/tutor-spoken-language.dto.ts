import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class TutorSpokenLanguageDto {
  @ApiProperty() languageCode!: string;
}

export class SetSpokenLanguagesDto {
  @ApiProperty({
    type: [String],
    description:
      'Full replace — the complete list of languages this tutor speaks, for parent communication.',
  })
  @IsArray()
  @IsString({ each: true })
  languageCodes!: string[];
}
