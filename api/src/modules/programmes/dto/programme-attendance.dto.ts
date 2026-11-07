import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const PROGRAMME_ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;

export class ProgrammeAttendanceDto {
  @ApiProperty() id!: string;
  @ApiProperty() programmeSessionId!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty({ enum: PROGRAMME_ATTENDANCE_STATUSES }) status!: string;
  @ApiPropertyOptional() markedBy?: string;
  @ApiProperty() markedAt!: Date;
  @ApiProperty() note!: string;
}

export class MarkProgrammeAttendanceDto {
  @ApiProperty() @IsUUID() learnerId!: string;

  @ApiProperty({ enum: PROGRAMME_ATTENDANCE_STATUSES })
  @IsIn(PROGRAMME_ATTENDANCE_STATUSES)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
