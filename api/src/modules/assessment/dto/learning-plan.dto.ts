import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

const GOAL_STATUSES = ['not_started', 'in_progress', 'achieved', 'not_achieved'] as const;

export class LearningPlanGoalDto {
  @ApiProperty() id!: string;
  @ApiProperty() subjectCode!: string;
  @ApiProperty() goal!: string;
  @ApiPropertyOptional() targetLevelCode?: number;
  @ApiPropertyOptional() targetDate?: string;
  @ApiProperty({ enum: GOAL_STATUSES }) status!: string;
  @ApiProperty() reviewNote!: string;
}

export class LearningPlanDto {
  @ApiProperty() id!: string;
  @ApiProperty() learnerId!: string;
  @ApiPropertyOptional() fromAssessmentId?: string;
  @ApiPropertyOptional() termId?: string;
  @ApiProperty({ enum: ['draft', 'active', 'completed', 'superseded'] }) status!: string;
  @ApiPropertyOptional() activatedAt?: string;
  @ApiProperty({ type: LearningPlanGoalDto, isArray: true }) goals!: LearningPlanGoalDto[];
}

export class CreateLearningPlanGoalDto {
  @ApiProperty() @IsString() subjectCode!: string;
  @ApiProperty() @IsString() goal!: string;
  @ApiPropertyOptional() @IsOptional() targetLevelCode?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() targetDate?: string;
}

export class CreateLearningPlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() fromAssessmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() termId?: string;

  @ApiProperty({
    type: [CreateLearningPlanGoalDto],
    minItems: 1,
    description: 'A learning plan needs at least one goal.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateLearningPlanGoalDto)
  goals!: CreateLearningPlanGoalDto[];
}

export class UpdateGoalStatusDto {
  @ApiProperty({ enum: GOAL_STATUSES })
  @IsIn(GOAL_STATUSES)
  status!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() reviewNote?: string;
}
