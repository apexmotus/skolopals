import { ApiProperty } from '@nestjs/swagger';

export class LanguageDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ description: 'True when the centre can teach in this language. Home and spoken languages use the full list.' })
  isInstructionMedium!: boolean;
}
