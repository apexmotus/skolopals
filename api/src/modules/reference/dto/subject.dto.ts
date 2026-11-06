import { ApiProperty } from '@nestjs/swagger';

export class SubjectDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() isLanguage!: boolean;
  @ApiProperty() sortOrder!: number;
}
