import { NotFoundException } from '@nestjs/common';
import type { CacheService } from '../../common/cache/cache.service';
import { ReviewsManager } from './reviews.manager';
import type { ReviewsRepository } from './reviews.repository';

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

const REVIEW_ROW = {
  id: 'r1',
  tutor_id: 't1',
  guardian_id: 'g1',
  learner_id: null,
  rating: 5,
  comment: 'Great tutor',
  status: 'pending',
  created_at: new Date('2026-11-01T00:00:00Z'),
  published_at: null,
  moderated_by: null,
};

describe('ReviewsManager.listPublished', () => {
  it('caches the result, keyed per tutor', async () => {
    const cache = makeCache();
    const listPublished = vi.fn().mockResolvedValue([{ ...REVIEW_ROW, status: 'published' }]);
    const repo = { listPublished } as unknown as ReviewsRepository;
    const manager = new ReviewsManager(repo, cache as unknown as CacheService);

    await manager.listPublished('t1');

    expect(cache.store.has('skolopals:reviews:listPublished:t1')).toBe(true);
  });
});

describe('ReviewsManager.submit', () => {
  it('always submits as the actor, never a client-supplied guardianId, and the row comes back pending', async () => {
    const submit = vi.fn().mockResolvedValue(REVIEW_ROW);
    const repo = { submit } as unknown as ReviewsRepository;
    const manager = new ReviewsManager(repo, makeCache() as unknown as CacheService);

    const dto = await manager.submit('t1', { id: 'g1', roles: ['parent'], claims: {} }, { rating: 5 });

    expect(submit).toHaveBeenCalledWith({
      tutorId: 't1',
      guardianId: 'g1',
      learnerId: undefined,
      rating: 5,
      comment: undefined,
    });
    expect(dto.status).toBe('pending');
  });
});

describe('ReviewsManager.moderate', () => {
  it('404s when the review does not exist', async () => {
    const repo = { moderate: vi.fn().mockResolvedValue(undefined) } as unknown as ReviewsRepository;
    const manager = new ReviewsManager(repo, makeCache() as unknown as CacheService);

    await expect(
      manager.moderate('missing', { status: 'published' }, { id: 'admin-1', roles: ['admin'], claims: {} }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('invalidates the published-list cache for that review\'s tutor', async () => {
    const cache = makeCache();
    cache.store.set('skolopals:reviews:listPublished:t1', [{ stale: true }]);
    const moderate = vi.fn().mockResolvedValue({ ...REVIEW_ROW, status: 'published', moderated_by: 'admin-1' });
    const repo = { moderate } as unknown as ReviewsRepository;
    const manager = new ReviewsManager(repo, cache as unknown as CacheService);

    await manager.moderate('r1', { status: 'published' }, { id: 'admin-1', roles: ['admin'], claims: {} });

    expect(cache.store.has('skolopals:reviews:listPublished:t1')).toBe(false);
  });
});
