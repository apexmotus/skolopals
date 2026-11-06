import { ApiProperty } from '@nestjs/swagger';

export class SchoolPhaseDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
}
