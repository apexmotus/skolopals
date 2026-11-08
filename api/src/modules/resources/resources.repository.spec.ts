import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { ResourcesRepository } from './resources.repository.js';

function makeSp(overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {}): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    selectOne: vi.fn().mockResolvedValue(undefined),
    executeRaw: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('ResourcesRepository.listForActor', () => {
  it('has no WHERE clause — RLS does the four-way audience filtering', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ResourcesRepository(makeSp({ selectMany }));

    await repo.listForActor();

    const [sql] = selectMany.mock.calls[0] as [string];
    // The nested `json_agg` subquery has its own WHERE (`a.resource_id = r.id`); only the top-level `resources r` scan must have none.
    expect(sql).not.toMatch(/from public\.resources r\s+where/);
    expect(sql).toContain('json_agg');
  });
});

describe('ResourcesRepository.getById', () => {
  it('scopes the select to the given id and still embeds audiences via json_agg', async () => {
    const selectOne = vi.fn().mockResolvedValue(undefined);
    const repo = new ResourcesRepository(makeSp({ selectOne }));

    await repo.getById('r1');

    const [sql, values] = selectOne.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('where r.id = $1');
    expect(sql).toContain('json_agg');
    expect(values).toEqual(['r1']);
  });
});

describe('ResourcesRepository.create', () => {
  it('inserts with coalesced defaults for optional url/storagePath and returns the new id', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [{ id: 'r1' }], rowCount: 1 });
    const repo = new ResourcesRepository(makeSp({ executeRaw }));

    const id = await repo.create({ title: 'Worksheet', createdBy: 'tutor-1' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert into public.resources');
    expect(values).toEqual(['Worksheet', null, null, null, 'tutor-1']);
    expect(id).toBe('r1');
  });

  it('throws if the insert unexpectedly returns no row', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new ResourcesRepository(makeSp({ executeRaw }));

    await expect(repo.create({ title: 'Worksheet', createdBy: 'tutor-1' })).rejects.toThrow(
      'INSERT ... RETURNING unexpectedly returned no row',
    );
  });
});

describe('ResourcesRepository.createAudience', () => {
  it('inserts the audience row with null for every field the audienceType does not use', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new ResourcesRepository(makeSp({ executeRaw }));

    await repo.createAudience({ resourceId: 'r1', audienceType: 'all' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert into public.resource_audiences');
    expect(values).toEqual(['r1', 'all', null, null, null]);
  });

  it('passes through whichever single targeting field is set', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new ResourcesRepository(makeSp({ executeRaw }));

    await repo.createAudience({ resourceId: 'r1', audienceType: 'grade', gradeCode: 'grade_8' });

    const [, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual(['r1', 'grade', null, null, 'grade_8']);
  });
});

describe('ResourcesRepository.update', () => {
  it('builds a SET clause only for the provided fields, with the id last', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const selectOne = vi.fn().mockResolvedValue({ id: 'r1' });
    const repo = new ResourcesRepository(makeSp({ executeRaw, selectOne }));

    await repo.update('r1', { title: 'New title' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('set title = $1');
    expect(sql).toContain('where id = $2');
    expect(values).toEqual(['New title', 'r1']);
  });

  it('re-reads instead of issuing an empty UPDATE when the patch is empty', async () => {
    const executeRaw = vi.fn();
    const selectOne = vi.fn().mockResolvedValue({ id: 'r1' });
    const repo = new ResourcesRepository(makeSp({ executeRaw, selectOne }));

    await repo.update('r1', {});

    expect(executeRaw).not.toHaveBeenCalled();
    expect(selectOne).toHaveBeenCalledTimes(1);
  });
});

describe('ResourcesRepository.removeAudience', () => {
  it('scopes the delete to both the audience id and its resource id', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new ResourcesRepository(makeSp({ executeRaw }));

    const removed = await repo.removeAudience('r1', 'a1');

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('where id = $1 and resource_id = $2');
    expect(values).toEqual(['a1', 'r1']);
    expect(removed).toBe(false);
  });
});
