import { AssessmentMapper } from './assessment.mapper.js';
import type { RecordAssessmentDto } from './dto/assessment.dto.js';
import type { CreateLearningPlanDto } from './dto/learning-plan.dto.js';
import type { AssessmentRow } from './rows/assessment.row.js';
import type { LearningPlanRow } from './rows/learning-plan.row.js';

describe('AssessmentMapper.toScoresPayload', () => {
  it('maps every score field to its snake_case jsonb key, preserving order', () => {
    const dto: RecordAssessmentDto = {
      assessmentTypeCode: 'initial',
      gradeCode: 'grade_7',
      assessedOn: '2026-11-07',
      scores: [
        { domainCode: 'reading', rawScore: 15, maxScore: 20, comment: 'Fluent' },
        { domainCode: 'numeracy', rawScore: 9, maxScore: 20 },
      ],
    };

    const payload = AssessmentMapper.toScoresPayload(dto);

    expect(payload).toEqual([
      { domain_code: 'reading', raw_score: 15, max_score: 20, comment: 'Fluent' },
      { domain_code: 'numeracy', raw_score: 9, max_score: 20, comment: undefined },
    ]);
  });
});

describe('AssessmentMapper.toGoalsPayload', () => {
  it('maps every goal field to its snake_case jsonb key, including a goal with no target date', () => {
    const dto: CreateLearningPlanDto = {
      goals: [
        { subjectCode: 'mathematics', goal: 'Master fractions', targetLevelCode: 5, targetDate: '2027-03-01' },
        { subjectCode: 'english', goal: 'Read a full chapter book' },
      ],
    };

    const payload = AssessmentMapper.toGoalsPayload(dto);

    expect(payload).toEqual([
      { subject_code: 'mathematics', goal: 'Master fractions', target_level_code: 5, target_date: '2027-03-01' },
      { subject_code: 'english', goal: 'Read a full chapter book', target_level_code: undefined, target_date: undefined },
    ]);
  });
});

describe('AssessmentMapper.toDto', () => {
  it('parses numeric score columns (returned as strings by pg) to numbers', () => {
    const row: AssessmentRow = {
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
      created_at: new Date('2026-11-07T10:00:00Z'),
      scores: [
        {
          id: 's-1',
          domain_code: 'reading',
          raw_score: '15.00',
          max_score: '20.00',
          achievement_level_code: 5,
          comment: 'Fluent',
          percent: '75.00',
        },
      ],
    };

    const dto = AssessmentMapper.toDto(row);

    expect(dto.scores[0]).toEqual({
      domainCode: 'reading',
      rawScore: 15,
      maxScore: 20,
      achievementLevelCode: 5,
      comment: 'Fluent',
      percent: 75,
    });
  });
});

describe('AssessmentMapper.planToDto', () => {
  it('maps a plan with its goals, converting activatedAt to an ISO string', () => {
    const row: LearningPlanRow = {
      id: 'lp-1',
      learner_id: 'l-1',
      from_assessment_id: 'a-1',
      term_id: null,
      status: 'active',
      created_by: 'profile-1',
      created_at: new Date('2026-11-07T10:00:00Z'),
      activated_at: new Date('2026-11-07T10:00:00Z'),
      goals: [
        {
          id: 'g-1',
          subject_code: 'mathematics',
          goal: 'Master fractions',
          target_level_code: 5,
          target_date: '2027-03-01',
          status: 'not_started',
          review_note: '',
        },
      ],
    };

    const dto = AssessmentMapper.planToDto(row);

    expect(dto.activatedAt).toBe('2026-11-07T10:00:00.000Z');
    expect(dto.goals).toEqual([
      {
        id: 'g-1',
        subjectCode: 'mathematics',
        goal: 'Master fractions',
        targetLevelCode: 5,
        targetDate: '2027-03-01',
        status: 'not_started',
        reviewNote: '',
      },
    ]);
  });
});
