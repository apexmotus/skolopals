import { NotFoundException } from '@nestjs/common';
import { AssessmentManager } from './assessment.manager.js';
import type { AssessmentRepository } from './assessment.repository.js';

const ASSESSMENT_ROW = {
  id: 'a-1',
  learner_id: 'l-1',
  assessment_type_code: 'initial',
  subject_code: null,
  grade_code: 'grade_7',
  term_id: null,
  administered_by: 'tutor-1',
  assessed_on: '2026-11-07',
  overall_level_code: null,
  notes: '',
  created_at: new Date(),
  scores: [],
};

describe('AssessmentManager.recordAssessment', () => {
  it('records the assessment then reads back the full row (with scores) for the response', async () => {
    const recordAssessment = vi.fn().mockResolvedValue('a-1');
    const getAssessmentById = vi.fn().mockResolvedValue(ASSESSMENT_ROW);
    const repo = {
      recordAssessment,
      getAssessmentById,
    } as unknown as AssessmentRepository;
    const manager = new AssessmentManager(repo);

    const dto = await manager.recordAssessment('l-1', {
      assessmentTypeCode: 'initial',
      gradeCode: 'grade_7',
      assessedOn: '2026-11-07',
      scores: [{ domainCode: 'reading', rawScore: 15, maxScore: 20 }],
    });

    expect(recordAssessment).toHaveBeenCalledWith(
      expect.objectContaining({ learnerId: 'l-1', assessmentTypeCode: 'initial' }),
    );
    expect(getAssessmentById).toHaveBeenCalledWith('a-1');
    expect(dto.id).toBe('a-1');
  });
});

describe('AssessmentManager.updateGoalStatus', () => {
  it('404s when the repository finds no matching goal', async () => {
    const repo = {
      updateGoalStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as AssessmentRepository;
    const manager = new AssessmentManager(repo);

    await expect(
      manager.updateGoalStatus('lp-1', 'g-1', { status: 'achieved' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes the status and reviewNote through to the repository', async () => {
    const updateGoalStatus = vi.fn().mockResolvedValue({
      id: 'g-1',
      learning_plan_id: 'lp-1',
      subject_code: 'mathematics',
      goal: 'Master fractions',
      target_level_code: 5,
      target_date: null,
      status: 'achieved',
      review_note: 'Confirmed in the last test',
    });
    const repo = { updateGoalStatus } as unknown as AssessmentRepository;
    const manager = new AssessmentManager(repo);

    const dto = await manager.updateGoalStatus('lp-1', 'g-1', {
      status: 'achieved',
      reviewNote: 'Confirmed in the last test',
    });

    expect(updateGoalStatus).toHaveBeenCalledWith('lp-1', 'g-1', {
      status: 'achieved',
      reviewNote: 'Confirmed in the last test',
    });
    expect(dto.status).toBe('achieved');
  });
});
