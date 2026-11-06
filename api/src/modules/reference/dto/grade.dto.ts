import { ApiProperty } from '@nestjs/swagger';

export class GradeDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() phaseCode!: string;
  @ApiProperty() sortOrder!: number;
}
