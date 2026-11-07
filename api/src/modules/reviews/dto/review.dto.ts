import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const MODERATION_STATUSES = ['published', 'rejected'] as const;

export class ReviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() tutorId!: string;
  @ApiProperty() guardianId!: string;
  @ApiPropertyOptional() learnerId?: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
  @ApiProperty() comment!: string;
  @ApiProperty({ enum: ['pending', 'published', 'rejected'] }) status!: string;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() publishedAt?: Date;
  @ApiPropertyOptional() moderatedBy?: string;
}

export class SubmitReviewDto {
  @ApiPropertyOptional({ description: 'Which child this review is about, if any.' })
  @IsOptional()
  @IsUUID()
  learnerId?: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ModerateReviewDto {
  @ApiProperty({ enum: MODERATION_STATUSES }) @IsIn(MODERATION_STATUSES) status!: string;
}
