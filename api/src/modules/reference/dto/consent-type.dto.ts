import { ApiProperty } from '@nestjs/swagger';

export class ConsentTypeDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() statuteRef!: string;
  @ApiProperty({ description: 'Required consents block enrolment activation.' })
  isRequired!: boolean;
  @ApiProperty() sortOrder!: number;
}
