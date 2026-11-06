import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MedicalNotesDto {
  @ApiProperty() learnerId!: string;
  @ApiProperty() allergies!: string;
  @ApiProperty() conditions!: string;
  @ApiProperty() medication!: string;
  @ApiProperty() accommodations!: string;
  @ApiPropertyOptional() updatedAt?: string;
  @ApiPropertyOptional() updatedBy?: string;
}

export class UpsertMedicalNotesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() allergies?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() conditions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() medication?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accommodations?: string;
}
