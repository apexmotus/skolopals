import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { AptitudeRepository } from './aptitude.repository.js';

function repoWith(queryOne: ReturnType<typeof vi.fn>) {
  return new AptitudeRepository({ queryOne } as unknown as StoredProcRunner);
}

const paramsOf = (queryOne: ReturnType<typeof vi.fn>, call = 0) =>
  queryOne.mock.calls[call]?.[1] as { name: string; value: unknown }[];

describe('AptitudeRepository', () => {
  it('only ever calls functions in the private schema', async () => {
    const queryOne = vi.fn().mockResolvedValue({});
    const repo = repoWith(queryOne);
    await repo.start('e1');
    await repo.state('a1');
    await repo.serve('a1', 'LOG-PAT-01', 3);
    await repo.currentItem('a1');
    await repo.answer('a1', 'LOG-PAT-01', 'B', 1200);
    await repo.complete('a1', {
      finalBand: 3,
      levelLabel: 'Developing',
      literacyPct: 50,
      logicPct: 60,
      lowConfidence: false,
    });
    await repo.result('a1');
    await repo.retake('a1');
    for (const [fn] of queryOne.mock.calls) {
      expect(fn).toMatch(/^private\.aptitude_/);
    }
  });

  it('unwraps the jsonb column named after the function', async () => {
    const queryOne = vi
      .fn()
      .mockResolvedValue({ aptitude_start: { attemptId: 'a1', status: 'in_progress' } });
    await expect(repoWith(queryOne).start('e1')).resolves.toEqual({
      attemptId: 'a1',
      status: 'in_progress',
    });
    expect(queryOne).toHaveBeenCalledWith('private.aptitude_start', [
      { name: 'p_enrolment_id', value: 'e1' },
    ]);
  });

  it('names every answer parameter', async () => {
    const queryOne = vi.fn().mockResolvedValue({});
    await repoWith(queryOne).answer('a1', 'LIT-01', 'C', 900);
    expect(paramsOf(queryOne)).toEqual([
      { name: 'p_attempt_id', value: 'a1' },
      { name: 'p_item_id', value: 'LIT-01' },
      { name: 'p_option_id', value: 'C' },
      { name: 'p_ms_taken', value: 900 },
    ]);
  });

  it('drops a null passage so logic questions have none', async () => {
    const queryOne = vi.fn().mockResolvedValue({
      aptitude_current_item: {
        seq: 4, total: 25, itemId: 'LOG-PAT-03', section: 'logic', stem: '?', options: [], passage: null,
      },
    });
    const item = await repoWith(queryOne).currentItem('a1');
    expect(item).not.toHaveProperty('passage');
  });

  it('returns null when no question is waiting', async () => {
    const queryOne = vi.fn().mockResolvedValue({ aptitude_current_item: null });
    await expect(repoWith(queryOne).currentItem('a1')).resolves.toBeNull();
  });
});
