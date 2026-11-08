import { Injectable, NotFoundException } from '@nestjs/common';
import { AssessmentMapper } from './assessment.mapper.js';
import { AssessmentRepository } from './assessment.repository.js';
import type { AssessmentDto, RecordAssessmentDto } from './dto/assessment.dto.js';
import type {
  CreateLearningPlanDto,
  LearningPlanDto,
  LearningPlanGoalDto,
  UpdateGoalStatusDto,
} from './dto/learning-plan.dto.js';

@Injectable()
export class AssessmentManager {
  constructor(private readonly repo: AssessmentRepository) {}

  async listAssessments(learnerId: string): Promise<AssessmentDto[]> {
    const rows = await this.repo.listAssessments(learnerId);
    return rows.map((row) => AssessmentMapper.toDto(row));
  }

  async recordAssessment(
    learnerId: string,
    dto: RecordAssessmentDto,
  ): Promise<AssessmentDto> {
    const id = await this.repo.recordAssessment({
      learnerId,
      assessmentTypeCode: dto.assessmentTypeCode,
      gradeCode: dto.gradeCode,
      assessedOn: dto.assessedOn,
      scores: AssessmentMapper.toScoresPayload(dto),
      subjectCode: dto.subjectCode,
      termId: dto.termId,
      notes: dto.notes,
    });
    const row = await this.repo.getAssessmentById(id);
    if (!row) throw new Error('Assessment not found immediately after recording it');
    return AssessmentMapper.toDto(row);
  }

  async listLearningPlans(learnerId: string): Promise<LearningPlanDto[]> {
    const rows = await this.repo.listLearningPlans(learnerId);
    return rows.map((row) => AssessmentMapper.planToDto(row));
  }

  async createLearningPlan(
    learnerId: string,
    dto: CreateLearningPlanDto,
  ): Promise<LearningPlanDto> {
    const id = await this.repo.createLearningPlan({
      learnerId,
      goals: AssessmentMapper.toGoalsPayload(dto),
      fromAssessmentId: dto.fromAssessmentId,
      termId: dto.termId,
    });
    const row = await this.repo.getLearningPlanById(id);
    if (!row) throw new Error('Learning plan not found immediately after creating it');
    return AssessmentMapper.planToDto(row);
  }

  async updateGoalStatus(
    learningPlanId: string,
    goalId: string,
    dto: UpdateGoalStatusDto,
  ): Promise<LearningPlanGoalDto> {
    const row = await this.repo.updateGoalStatus(learningPlanId, goalId, {
      status: dto.status,
      reviewNote: dto.reviewNote,
    });
    if (!row) throw new NotFoundException('Learning plan goal not found.');
    return AssessmentMapper.goalUpdateToDto(row);
  }
}
