import { ApiProperty } from '@nestjs/swagger';

export class AssessmentTypeDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() sortOrder!: number;
}
