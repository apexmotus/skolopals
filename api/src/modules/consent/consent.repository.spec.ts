import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { ConsentRepository } from './consent.repository.js';

function makeSp(overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {}): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    selectOne: vi.fn().mockResolvedValue(undefined),
    executeRaw: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('ConsentRepository.withdraw', () => {
  it('is an UPDATE setting withdrawn_at, never a DELETE, scoped to the live row owned by this exact guardian', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [{ id: 'c1' }], rowCount: 1 });
    const repo = new ConsentRepository(makeSp({ executeRaw }));

    await repo.withdraw('learner-1', 'enrolment_s35', 'guardian-1');

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('update public.consents set withdrawn_at = now()');
    expect(sql).not.toContain('delete');
    expect(sql).toContain('and withdrawn_at is null');
    expect(values).toEqual(['learner-1', 'enrolment_s35', 'guardian-1']);
  });
});

describe('ConsentRepository.recordLearnerRetentionAction', () => {
  it('always writes record_class = learner_records and derives subject_label from the learner\'s own name', async () => {
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'log-1' }], rowCount: 1 });
    const repo = new ConsentRepository(makeSp({ executeRaw }));

    await repo.recordLearnerRetentionAction({
      learnerId: 'learner-1',
      action: 'deleted',
      confirmedBy: 'admin-1',
    });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("select 'learner_records'");
    expect(sql).toContain('from public.learners where id = $1');
    expect(values).toEqual(['learner-1', 'deleted', 'admin-1', null]);
  });
});
