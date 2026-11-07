import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const STATUSES = ['pending', 'active', 'paused', 'ended', 'declined'] as const;

export class EnrolmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty() packageCode!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiPropertyOptional() preferredTutorId?: string;
  @ApiPropertyOptional() assignedTutorId?: string;
  @ApiPropertyOptional() startDate?: string;
  @ApiPropertyOptional() endDate?: string;
  @ApiProperty() source!: string;
}

export class ListEnrolmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: string;
}
