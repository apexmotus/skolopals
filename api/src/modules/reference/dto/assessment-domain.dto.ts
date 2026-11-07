import { ApiProperty } from '@nestjs/swagger';

export class AssessmentDomainDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() sortOrder!: number;
}
