import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, IsUrl, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const SESSION_STATUSES = ['scheduled', 'held', 'cancelled'] as const;

export class ClassSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() classGroupId!: string;
  @ApiPropertyOptional() scheduleId?: string;
  @ApiProperty() sessionDate!: string;
  @ApiProperty() startsAt!: Date;
  @ApiProperty() endsAt!: Date;
  @ApiProperty({ enum: SESSION_STATUSES }) status!: string;
  @ApiPropertyOptional({
    description: 'A substitute for this occurrence only. Absent means the class group tutor.',
  })
  tutorId?: string;
  @ApiPropertyOptional() meetingUrl?: string;
  @ApiProperty() notes!: string;
}

export class ListClassSessionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() classGroupId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fromDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() toDate?: string;
  @ApiPropertyOptional({ enum: SESSION_STATUSES })
  @IsOptional()
  @IsIn(SESSION_STATUSES)
  status?: string;
}

export class UpdateClassSessionStatusDto {
  @ApiPropertyOptional({ enum: SESSION_STATUSES })
  @IsOptional()
  @IsIn(SESSION_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Per session, not per class — a leaked link expires with the session.' })
  @IsOptional()
  @IsUrl()
  meetingUrl?: string;
}
