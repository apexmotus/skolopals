import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const ATTEMPT_STATUSES = ['in_progress', 'completed', 'abandoned'] as const;

export class StartAttemptDto {
  @ApiProperty({ description: 'The pending application the test belongs to.' })
  @IsUUID()
  enrolmentId!: string;
}

export class AttemptDto {
  @ApiProperty() attemptId!: string;
  @ApiProperty({ enum: ATTEMPT_STATUSES }) status!: string;
}

export class AptitudeOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() text!: string;
}

export class AptitudePassageDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() text!: string;
}

/** One question as the child sees it. Never carries the answer. */
export class AptitudeQuestionDto {
  @ApiProperty({ description: '1-based position in the test.' }) seq!: number;
  @ApiProperty() total!: number;
  @ApiProperty() itemId!: string;
  @ApiProperty({ enum: ['literacy', 'logic'] }) section!: string;
  @ApiProperty() stem!: string;
  @ApiProperty({ type: AptitudeOptionDto, isArray: true })
  options!: AptitudeOptionDto[];
  @ApiPropertyOptional({ type: AptitudePassageDto })
  passage?: AptitudePassageDto;
}

export class NextQuestionDto {
  @ApiProperty({ description: 'True once every question is answered.' })
  done!: boolean;
  @ApiPropertyOptional({ type: AptitudeQuestionDto })
  question?: AptitudeQuestionDto;
}

export class SubmitAnswerDto {
  @ApiProperty() @IsString() @MaxLength(64) itemId!: string;
  @ApiProperty() @IsString() @MaxLength(8) optionId!: string;

  @ApiProperty({ description: 'Time on the question, in milliseconds.' })
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  msTaken!: number;
}

export class AptitudeBreakdownItemDto {
  @ApiProperty() seq!: number;
  @ApiProperty() itemId!: string;
  @ApiProperty() section!: string;
  @ApiProperty() skill!: string;
  @ApiProperty({ description: 'The level the engine was testing at.' })
  difficulty!: number;
  @ApiProperty() stem!: string;
  @ApiProperty() chosenOption!: string;
  @ApiProperty() chosenText!: string;
  @ApiProperty() correctOption!: string;
  @ApiProperty() correctText!: string;
  @ApiProperty() isCorrect!: boolean;
  @ApiPropertyOptional() msTaken?: number;
}

/**
 * Shaped by who asks (SPEC §4.3): a guardian gets the summary fields only,
 * a tutor adds band and confidence, an administrator also gets `breakdown`.
 */
export class AptitudeResultDto {
  @ApiProperty() attemptId!: string;
  @ApiProperty() completedAt!: string;
  @ApiProperty() levelLabel!: string;
  @ApiProperty() literacyPct!: number;
  @ApiProperty() logicPct!: number;
  @ApiPropertyOptional() tutorNote?: string;
  @ApiPropertyOptional() finalBand?: number;
  @ApiPropertyOptional() lowConfidence?: boolean;
  @ApiPropertyOptional() startedAt?: string;
  @ApiPropertyOptional({ type: AptitudeBreakdownItemDto, isArray: true })
  breakdown?: AptitudeBreakdownItemDto[];
}
