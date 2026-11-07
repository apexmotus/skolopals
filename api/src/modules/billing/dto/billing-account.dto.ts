import { ApiProperty } from '@nestjs/swagger';

export class BillingAccountDto {
  @ApiProperty() id!: string;
  @ApiProperty() guardianId!: string;
  @ApiProperty({ enum: ['active', 'suspended', 'closed'] }) status!: string;
  @ApiProperty() createdAt!: Date;
}
