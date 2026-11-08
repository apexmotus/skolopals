import type {
  AssessmentDto,
  AssessmentScoreDto,
  RecordAssessmentDto,
} from './dto/assessment.dto.js';
import type {
  CreateLearningPlanDto,
  LearningPlanDto,
  LearningPlanGoalDto,
} from './dto/learning-plan.dto.js';
import type { AssessmentRow, AssessmentScoreRow } from './rows/assessment.row.js';
import type {
  LearningPlanGoalRow,
  LearningPlanGoalUpdateRow,
  LearningPlanRow,
} from './rows/learning-plan.row.js';

export class AssessmentMapper {
  /** Pure DTO→jsonb assembly, unit-tested in isolation, same reasoning as `EnrolmentMapper.toSubmitPayload`. */
  static toScoresPayload(dto: RecordAssessmentDto): Record<string, unknown>[] {
    return dto.scores.map((score) => ({
      domain_code: score.domainCode,
      raw_score: score.rawScore,
      max_score: score.maxScore,
      comment: score.comment,
    }));
  }

  static toGoalsPayload(
    dto: CreateLearningPlanDto,
  ): Record<string, unknown>[] {
    return dto.goals.map((goal) => ({
      subject_code: goal.subjectCode,
      goal: goal.goal,
      target_level_code: goal.targetLevelCode,
      target_date: goal.targetDate,
    }));
  }

  static scoreToDto(row: AssessmentScoreRow): AssessmentScoreDto {
    return {
      domainCode: row.domain_code,
      rawScore: row.raw_score !== null ? Number(row.raw_score) : undefined,
      maxScore: row.max_score !== null ? Number(row.max_score) : undefined,
      achievementLevelCode: row.achievement_level_code ?? undefined,
      comment: row.comment,
      percent: row.percent !== null ? Number(row.percent) : undefined,
    };
  }

  static toDto(row: AssessmentRow): AssessmentDto {
    return {
      id: row.id,
      learnerId: row.learner_id,
      assessmentTypeCode: row.assessment_type_code,
      subjectCode: row.subject_code ?? undefined,
      gradeCode: row.grade_code,
      termId: row.term_id ?? undefined,
      administeredBy: row.administered_by ?? undefined,
      assessedOn: row.assessed_on,
      overallLevelCode: row.overall_level_code ?? undefined,
      notes: row.notes,
      scores: row.scores.map((score) => AssessmentMapper.scoreToDto(score)),
    };
  }

  static goalToDto(row: LearningPlanGoalRow): LearningPlanGoalDto {
    return {
      id: row.id,
      subjectCode: row.subject_code,
      goal: row.goal,
      targetLevelCode: row.target_level_code ?? undefined,
      targetDate: row.target_date ?? undefined,
      status: row.status,
      reviewNote: row.review_note,
    };
  }

  static goalUpdateToDto(row: LearningPlanGoalUpdateRow): LearningPlanGoalDto {
    return AssessmentMapper.goalToDto(row);
  }

  static planToDto(row: LearningPlanRow): LearningPlanDto {
    return {
      id: row.id,
      learnerId: row.learner_id,
      fromAssessmentId: row.from_assessment_id ?? undefined,
      termId: row.term_id ?? undefined,
      status: row.status,
      activatedAt: row.activated_at?.toISOString(),
      goals: row.goals.map((goal) => AssessmentMapper.goalToDto(goal)),
    };
  }
}
