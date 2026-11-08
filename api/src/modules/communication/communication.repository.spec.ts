import type { SpParam } from '../../database/sp-param.js';
import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { CommunicationRepository } from './communication.repository.js';

function makeSp(overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {}): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    selectOne: vi.fn().mockResolvedValue(undefined),
    executeRaw: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    queryOne: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('CommunicationRepository.startThread', () => {
  it('calls start_thread with the native uuid[] participants array, not a jsonb payload', async () => {
    const queryOne = vi.fn().mockResolvedValue({ start_thread: 't1' });
    const repo = new CommunicationRepository(makeSp({ queryOne }));

    await repo.startThread({ body: 'Hi', participantIds: ['p1', 'p2'] });

    const [fnName, params] = queryOne.mock.calls[0] as [string, SpParam[]];
    expect(fnName).toBe('public.start_thread');
    expect(params.find((prm) => prm.name === 'p_participants')).toEqual({
      name: 'p_participants',
      value: ['p1', 'p2'],
    });
  });
});

describe('CommunicationRepository.fanOutToAllProfiles', () => {
  it('is one INSERT ... SELECT against the whole profiles table, not a per-profile loop', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new CommunicationRepository(makeSp({ executeRaw }));

    await repo.fanOutToAllProfiles('n1');

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('select $1, id from public.profiles');
    expect(values).toEqual(['n1']);
  });
});

describe('CommunicationRepository.fanOutToRecipients', () => {
  it('is one INSERT ... unnest, not a per-profile loop', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new CommunicationRepository(makeSp({ executeRaw }));

    await repo.fanOutToRecipients('n1', ['p1', 'p2']);

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('unnest($2::uuid[])');
    expect(values).toEqual(['n1', ['p1', 'p2']]);
  });
});

describe('CommunicationRepository.addParticipant', () => {
  it('re-reads the existing row rather than fabricate one when the insert conflicts (already a participant)', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const selectOne = vi
      .fn()
      .mockResolvedValue({ thread_id: 't1', profile_id: 'p1', added_at: new Date() });
    const repo = new CommunicationRepository(makeSp({ executeRaw, selectOne }));

    const row = await repo.addParticipant('t1', 'p1');

    expect(row.profile_id).toBe('p1');
    expect(selectOne).toHaveBeenCalledTimes(1);
  });
});
