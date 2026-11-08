import { ApiProperty } from '@nestjs/swagger';

export class DataRetentionPolicyDto {
  @ApiProperty() recordClass!: string;
  @ApiProperty() description!: string;
  @ApiProperty() retentionMonths!: number;
  @ApiProperty() basis!: string;
}
