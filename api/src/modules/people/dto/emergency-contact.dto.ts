import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class EmergencyContactDto {
  @ApiProperty() id!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() relationship!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) priority!: number;
}

export class AddEmergencyContactDto {
  @ApiProperty() @IsString() @MaxLength(200) fullName!: string;
  @ApiProperty() @IsString() @MaxLength(100) relationship!: string;
  @ApiProperty() @IsString() @MaxLength(50) phone!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  priority!: number;
}
