import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConsentDto {
  @ApiProperty() id!: string;
  @ApiProperty() consentTypeCode!: string;
  @ApiProperty() guardianId!: string;
  @ApiPropertyOptional() learnerId?: string;
  @ApiProperty() granted!: boolean;
  @ApiProperty() grantedAt!: Date;
  @ApiPropertyOptional() withdrawnAt?: Date;
  @ApiProperty() policyVersion!: string;
}
