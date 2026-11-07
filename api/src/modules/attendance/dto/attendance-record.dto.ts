import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;

export class AttendanceRecordDto {
  @ApiProperty() id!: string;
  @ApiProperty() classSessionId!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty({ enum: ATTENDANCE_STATUSES }) status!: string;
  @ApiPropertyOptional() markedBy?: string;
  @ApiProperty() markedAt!: Date;
  @ApiProperty() note!: string;
}

export class MarkAttendanceDto {
  @ApiProperty() @IsUUID() learnerId!: string;

  @ApiProperty({ enum: ATTENDANCE_STATUSES })
  @IsIn(ATTENDANCE_STATUSES)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class CorrectAttendanceDto {
  @ApiPropertyOptional({ enum: ATTENDANCE_STATUSES })
  @IsOptional()
  @IsIn(ATTENDANCE_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
