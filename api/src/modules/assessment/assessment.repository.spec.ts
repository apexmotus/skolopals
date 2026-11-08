import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { AssessmentRepository } from './assessment.repository.js';

function makeSp(
  overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {},
): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    selectOne: vi.fn().mockResolvedValue(undefined),
    executeRaw: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    queryOne: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('AssessmentRepository.recordAssessment', () => {
  it('calls public.record_assessment with named params, jsonb-encoding the scores array', async () => {
    const queryOne = vi.fn().mockResolvedValue({ record_assessment: 'a-1' });
    const repo = new AssessmentRepository(makeSp({ queryOne }));

    await repo.recordAssessment({
      learnerId: 'l-1',
      assessmentTypeCode: 'initial',
      gradeCode: 'grade_7',
      assessedOn: '2026-11-07',
      scores: [{ domain_code: 'reading', raw_score: 15, max_score: 20 }],
    });

    const [fnName, params] = queryOne.mock.calls[0] as [string, { name: string; value: unknown }[]];
    expect(fnName).toBe('public.record_assessment');
    expect(params.map((param) => param.name)).toEqual([
      'p_learner_id',
      'p_type',
      'p_grade_code',
      'p_assessed_on',
      'p_scores',
      'p_subject',
      'p_term_id',
      'p_notes',
    ]);
    const scoresParam = params.find((param) => param.name === 'p_scores');
    expect(scoresParam?.value).toBe(
      JSON.stringify([{ domain_code: 'reading', raw_score: 15, max_score: 20 }]),
    );
  });
});

describe('AssessmentRepository.updateGoalStatus', () => {
  it('scopes the UPDATE by both the goal id and its learning plan id', async () => {
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'g-1' }], rowCount: 1 });
    const repo = new AssessmentRepository(makeSp({ executeRaw }));

    await repo.updateGoalStatus('lp-1', 'g-1', { status: 'achieved' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('status = $1');
    expect(sql).toContain('where id = $2 and learning_plan_id = $3');
    expect(values).toEqual(['achieved', 'g-1', 'lp-1']);
  });

  it('includes review_note only when given', async () => {
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'g-1' }], rowCount: 1 });
    const repo = new AssessmentRepository(makeSp({ executeRaw }));

    await repo.updateGoalStatus('lp-1', 'g-1', { status: 'achieved', reviewNote: 'Confirmed' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('review_note = $2');
    expect(values).toEqual(['achieved', 'Confirmed', 'g-1', 'lp-1']);
  });

  it('returns undefined when nothing matched (e.g. the goal belongs to a different plan)', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new AssessmentRepository(makeSp({ executeRaw }));

    const row = await repo.updateGoalStatus('lp-wrong', 'g-1', { status: 'achieved' });

    expect(row).toBeUndefined();
  });
});

describe('AssessmentRepository list/get methods', () => {
  it('embeds scores via json_agg rather than a separate query', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new AssessmentRepository(makeSp({ selectMany }));

    await repo.listAssessments('l-1');

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('json_agg');
    expect(sql).toContain('from public.assessment_scores s where s.assessment_id = a.id');
    expect(values).toEqual(['l-1']);
  });

  it('embeds goals via json_agg for learning plans', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new AssessmentRepository(makeSp({ selectMany }));

    await repo.listLearningPlans('l-1');

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('json_agg');
    expect(sql).toContain('from public.learning_plan_goals g where g.learning_plan_id = lp.id');
    expect(values).toEqual(['l-1']);
  });
});
