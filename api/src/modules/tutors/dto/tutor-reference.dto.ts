import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const OUTCOMES = ['positive', 'negative', 'unreachable'] as const;

export class TutorReferenceDto {
  @ApiProperty() id!: string;
  @ApiProperty() tutorId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() relationship!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional() checkedAt?: string;
  @ApiPropertyOptional({ enum: OUTCOMES }) outcome?: string;
}

export class AddReferenceDto {
  @ApiProperty() @IsString() @MaxLength(200) fullName!: string;
  @ApiProperty() @IsString() @MaxLength(100) relationship!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
}

export class RecordOutcomeDto {
  @ApiProperty({ enum: OUTCOMES }) @IsIn(OUTCOMES) outcome!: string;
}
