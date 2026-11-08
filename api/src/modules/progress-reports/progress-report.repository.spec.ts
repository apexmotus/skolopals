import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { ProgressReportRepository } from './progress-report.repository.js';

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

describe('ProgressReportRepository.save', () => {
  it('calls public.save_progress_report with named params, jsonb-encoding the subjects array', async () => {
    const queryOne = vi.fn().mockResolvedValue({ save_progress_report: 'r-1' });
    const repo = new ProgressReportRepository(makeSp({ queryOne }));

    await repo.save({
      learnerId: 'l-1',
      termId: 't-1',
      publish: true,
      subjects: [{ subject_code: 'mathematics' }],
    });

    const [fnName, params] = queryOne.mock.calls[0] as [string, { name: string; value: unknown }[]];
    expect(fnName).toBe('public.save_progress_report');
    expect(params.map((param) => param.name)).toEqual([
      'p_learner_id',
      'p_term_id',
      'p_summary',
      'p_subjects',
      'p_publish',
      'p_attendance_note',
    ]);
    const publishParam = params.find((param) => param.name === 'p_publish');
    expect(publishParam?.value).toBe(true);
  });
});

describe('ProgressReportRepository.acknowledge', () => {
  it('inserts with the guardian id and defaults comment to empty', async () => {
    const executeRaw = vi.fn().mockResolvedValue({
      rows: [{ guardian_id: 'guardian-1', acknowledged_at: new Date(), comment: '' }],
      rowCount: 1,
    });
    const repo = new ProgressReportRepository(makeSp({ executeRaw }));

    await repo.acknowledge('r-1', 'guardian-1');

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("coalesce($3, '')");
    expect(values).toEqual(['r-1', 'guardian-1', null]);
  });
});

describe('ProgressReportRepository list/get methods', () => {
  it('embeds subjects and acknowledgements via json_agg rather than separate queries', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ProgressReportRepository(makeSp({ selectMany }));

    await repo.listByLearner('l-1');

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('from public.progress_report_subjects rs where rs.progress_report_id = r.id');
    expect(sql).toContain('from public.report_acknowledgements ra where ra.progress_report_id = r.id');
    expect(values).toEqual(['l-1']);
  });
});
