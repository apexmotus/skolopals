import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class LearnerGuardianDto {
  @ApiProperty() learnerId!: string;
  @ApiProperty() guardianId!: string;

  /** Unset when the caller (e.g. a teaching tutor) can see that this guardian link exists but not the guardian's own profile — `profiles`' RLS is self-or-admin only. */
  @ApiPropertyOptional() guardianName?: string;
  @ApiPropertyOptional() guardianPhone?: string;

  @ApiProperty() relationship!: string;
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty() isBillingContact!: boolean;
}

export class AddGuardianDto {
  @ApiProperty({ description: "The guardian's existing profile id." })
  @IsUUID()
  guardianId!: string;

  @ApiProperty({ example: 'mother' }) @IsString() relationship!: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isBillingContact?: boolean;
}

export class SetContactFlagsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isBillingContact?: boolean;
}
