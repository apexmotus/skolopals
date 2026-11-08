import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { ReviewsRepository } from './reviews.repository.js';

function makeSp(overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {}): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    executeRaw: vi.fn().mockResolvedValue({ rows: [{ id: 'r1' }], rowCount: 1 }),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('ReviewsRepository.submit', () => {
  it('never passes status explicitly — the table default (pending) already satisfies the RLS insert check', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [{ id: 'r1' }], rowCount: 1 });
    const repo = new ReviewsRepository(makeSp({ executeRaw }));

    await repo.submit({ tutorId: 't1', guardianId: 'g1', rating: 5 });

    const [sql] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert into public.reviews (tutor_id, guardian_id, learner_id, rating, comment)');
  });
});

describe('ReviewsRepository.moderate', () => {
  it('only sets published_at the first time, never clearing or re-stamping it on a later re-moderation', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [{ id: 'r1' }], rowCount: 1 });
    const repo = new ReviewsRepository(makeSp({ executeRaw }));

    await repo.moderate('r1', 'published', 'admin-1');

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('coalesce(published_at, now())');
    expect(values).toEqual(['r1', 'published', 'admin-1']);
  });
});
