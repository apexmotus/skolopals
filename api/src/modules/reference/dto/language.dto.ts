import { ApiProperty } from '@nestjs/swagger';

export class LanguageDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
}
