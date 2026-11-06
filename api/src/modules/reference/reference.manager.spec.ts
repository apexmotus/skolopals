import type { CacheService } from '../../common/cache/cache.service';
import type { ReferenceRepository } from './reference.repository';
import { ReferenceManager } from './reference.manager';
import { referenceCacheKeys } from './reference-cache-keys';

function makeCache(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: vi.fn((...keys: string[]) => {
      for (const key of keys) store.delete(key);
      return Promise.resolve();
    }),
    store,
  };
}

describe('ReferenceManager', () => {
  it('listGrades caches on a miss and returns mapped DTOs', async () => {
    const cache = makeCache();
    const listGrades = vi.fn().mockResolvedValue([
      {
        code: 'grade_7',
        name: 'Grade 7',
        phase_code: 'senior',
        sort_order: 7,
      },
    ]);
    const repo = { listGrades } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(
      repo,
      cache as unknown as CacheService,
    );

    const dtos = await manager.listGrades();

    expect(dtos).toEqual([
      { code: 'grade_7', name: 'Grade 7', phaseCode: 'senior', sortOrder: 7 },
    ]);
    expect(listGrades).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(
      referenceCacheKeys.grades,
      dtos,
      3600,
    );
  });

  it('listGrades returns the cached value on a hit, without calling the repository', async () => {
    const cached = [
      { code: 'grade_7', name: 'Grade 7', phaseCode: 'senior', sortOrder: 7 },
    ];
    const cache = makeCache({ [referenceCacheKeys.grades]: cached });
    const listGrades = vi.fn();
    const repo = { listGrades } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(
      repo,
      cache as unknown as CacheService,
    );

    const dtos = await manager.listGrades();

    expect(dtos).toBe(cached);
    expect(listGrades).not.toHaveBeenCalled();
  });

  it('listOfferings keys the cache per gradeCode, including the "all" case', async () => {
    const cache = makeCache();
    const listOfferings = vi.fn().mockResolvedValue([]);
    const repo = { listOfferings } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(
      repo,
      cache as unknown as CacheService,
    );

    await manager.listOfferings('grade_7');
    await manager.listOfferings();

    expect(listOfferings).toHaveBeenNthCalledWith(1, 'grade_7');
    expect(listOfferings).toHaveBeenNthCalledWith(2, null);
    expect(
      cache.store.has(referenceCacheKeys.subjectOfferings('grade_7')),
    ).toBe(true);
    expect(cache.store.has(referenceCacheKeys.subjectOfferings(null))).toBe(
      true,
    );
  });

  it('createTerm invalidates the terms cache after writing', async () => {
    const cache = makeCache({ [referenceCacheKeys.terms]: [{ stale: true }] });
    const createTerm = vi.fn().mockResolvedValue({
      id: 't1',
      year: 2027,
      term_number: 1,
      starts_on: '2027-01-13',
      ends_on: '2027-03-19',
    });
    const repo = { createTerm } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(
      repo,
      cache as unknown as CacheService,
    );

    const dto = await manager.createTerm({
      year: 2027,
      termNumber: 1,
      startsOn: '2027-01-13',
      endsOn: '2027-03-19',
    });

    expect(dto).toEqual({
      id: 't1',
      year: 2027,
      termNumber: 1,
      startsOn: '2027-01-13',
      endsOn: '2027-03-19',
    });
    expect(cache.store.has(referenceCacheKeys.terms)).toBe(false);
  });

  it('createRoom invalidates the rooms cache after writing', async () => {
    const cache = makeCache({ [referenceCacheKeys.rooms]: [{ stale: true }] });
    const createRoom = vi.fn().mockResolvedValue({
      id: 'r1',
      name: 'Room A',
      capacity: 5,
      is_active: true,
    });
    const repo = { createRoom } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(
      repo,
      cache as unknown as CacheService,
    );

    await manager.createRoom({ name: 'Room A', capacity: 5 });

    expect(cache.store.has(referenceCacheKeys.rooms)).toBe(false);
  });
});
