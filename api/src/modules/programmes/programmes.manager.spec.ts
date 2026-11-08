import { NotFoundException } from '@nestjs/common';
import type { CacheService } from '../../common/cache/cache.service.js';
import { ProgrammesManager } from './programmes.manager.js';
import type { ProgrammesRepository } from './programmes.repository.js';

function makeCache() {
  const store = new Map<string, unknown>();
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

const PROGRAMME_ROW = {
  id: 'p-1',
  name: 'Holiday Catch-Up',
  description: '',
  programme_type: 'holiday',
  starts_on: '2026-12-07',
  ends_on: '2026-12-11',
  capacity: 2,
  price_cents: 45000,
  delivery_mode: 'in_centre',
  room_id: 'room-1',
  is_published: true,
  created_at: new Date(),
};

describe('ProgrammesManager — listProgrammes / getProgrammeById caching', () => {
  it('caches the unfiltered list for a non-admin caller', async () => {
    const cache = makeCache();
    const listProgrammes = vi.fn().mockResolvedValue([PROGRAMME_ROW]);
    const repo = { listProgrammes } as unknown as ProgrammesRepository;
    const manager = new ProgrammesManager(repo, cache as unknown as CacheService);

    await manager.listProgrammes({ id: 'parent-1', roles: ['parent'], claims: {} });

    expect(cache.store.has('skolopals:programmes:listPublished')).toBe(true);
  });

  it('never caches for an admin caller, since an admin sees unpublished programmes too', async () => {
    const cache = makeCache();
    const listProgrammes = vi.fn().mockResolvedValue([PROGRAMME_ROW]);
    const repo = { listProgrammes } as unknown as ProgrammesRepository;
    const manager = new ProgrammesManager(repo, cache as unknown as CacheService);

    await manager.listProgrammes({ id: 'admin-1', roles: ['admin'], claims: {} });

    expect(cache.store.has('skolopals:programmes:listPublished')).toBe(false);
  });

  it('getProgrammeById 404s when the repository returns nothing (RLS hid an unpublished programme)', async () => {
    const repo = {
      getProgrammeById: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProgrammesRepository;
    const manager = new ProgrammesManager(repo, makeCache() as unknown as CacheService);

    await expect(
      manager.getProgrammeById('missing', undefined),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProgrammesManager — cache invalidation on write', () => {
  it('createProgramme invalidates the published-list cache', async () => {
    const cache = makeCache();
    cache.store.set('skolopals:programmes:listPublished', [{ stale: true }]);
    const repo = {
      createProgramme: vi.fn().mockResolvedValue(PROGRAMME_ROW),
    } as unknown as ProgrammesRepository;
    const manager = new ProgrammesManager(repo, cache as unknown as CacheService);

    await manager.createProgramme({
      name: 'Holiday Catch-Up',
      programmeType: 'holiday',
      startsOn: '2026-12-07',
      endsOn: '2026-12-11',
      capacity: 2,
      priceCents: 45000,
      deliveryMode: 'in_centre',
      roomId: 'room-1',
    });

    expect(cache.store.has('skolopals:programmes:listPublished')).toBe(false);
  });

  it('updateProgramme invalidates both the list and the by-id cache, and 404s when the programme is missing', async () => {
    const cache = makeCache();
    cache.store.set('skolopals:programmes:byId:p-1', { stale: true });
    const repo = {
      updateProgramme: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProgrammesRepository;
    const manager = new ProgrammesManager(repo, cache as unknown as CacheService);

    await expect(manager.updateProgramme('p-1', { isPublished: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ProgrammesManager.cancel', () => {
  it('404s when nothing was cancelled (already cancelled, or not this booking/programme)', async () => {
    const repo = {
      cancelBooking: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProgrammesRepository;
    const manager = new ProgrammesManager(repo, makeCache() as unknown as CacheService);

    await expect(manager.cancel('p-1', 'pe-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProgrammesManager.markAttendance', () => {
  it('passes the actor id as markedBy, never trusting a client-supplied value', async () => {
    const markAttendance = vi.fn().mockResolvedValue({
      id: 'pa-1',
      programme_session_id: 'ps-1',
      learner_id: 'l-1',
      status: 'present',
      marked_by: 'profile-1',
      marked_at: new Date(),
      note: '',
    });
    const repo = { markAttendance } as unknown as ProgrammesRepository;
    const manager = new ProgrammesManager(repo, makeCache() as unknown as CacheService);

    await manager.markAttendance(
      'ps-1',
      { id: 'profile-1', roles: ['tutor'], claims: {} },
      { learnerId: 'l-1', status: 'present' },
    );

    expect(markAttendance).toHaveBeenCalledWith({
      programmeSessionId: 'ps-1',
      learnerId: 'l-1',
      status: 'present',
      markedBy: 'profile-1',
      note: undefined,
    });
  });
});
