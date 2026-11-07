import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SessionCheckInDto {
  @ApiProperty() id!: string;
  @ApiProperty() classSessionId!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty() arrivedAt!: Date;
  @ApiPropertyOptional() signedInBy?: string;
  @ApiPropertyOptional() departedAt?: Date;
  @ApiPropertyOptional() collectedBy?: string;
  @ApiPropertyOptional() signedOutBy?: string;
  @ApiProperty() note!: string;
}

export class RecordCheckInDto {
  @ApiProperty() @IsUUID() learnerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class SignOutCheckInDto {
  @ApiProperty({
    description:
      "The authorised collector's id. Rejected unless they are on this learner's active collector list as of today.",
  })
  @IsUUID()
  collectedBy!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
