import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, IsUrl, MaxLength } from 'class-validator';

export class ProgrammeSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() programmeId!: string;
  @ApiProperty() sessionDate!: string;
  @ApiProperty() startsAt!: Date;
  @ApiProperty() endsAt!: Date;
  @ApiPropertyOptional() tutorId?: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() meetingUrl?: string;
  @ApiProperty() notes!: string;
}

export class AddProgrammeSessionDto {
  @ApiProperty() @IsDateString() sessionDate!: string;
  @ApiProperty() @IsDateString() startsAt!: string;
  @ApiProperty() @IsDateString() endsAt!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() tutorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  meetingUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
