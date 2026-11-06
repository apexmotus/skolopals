import type { Redis } from 'ioredis';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  it('returns undefined for a cache miss', async () => {
    const client = { get: vi.fn().mockResolvedValue(null) } as unknown as Redis;
    const cache = new CacheService(client);

    await expect(cache.get('k')).resolves.toBeUndefined();
  });

  it('round-trips a JSON-serialisable value', async () => {
    const store = new Map<string, string>();
    const client = {
      get: vi.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      set: vi.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve('OK');
      }),
    } as unknown as Redis;
    const cache = new CacheService(client);

    await cache.set('k', { a: 1 }, 60);

    expect(client.set).toHaveBeenCalledWith(
      'k',
      JSON.stringify({ a: 1 }),
      'EX',
      60,
    );
    await expect(cache.get('k')).resolves.toEqual({ a: 1 });
  });

  it('del is a no-op with no keys (never calls the client with an empty arg list)', async () => {
    const del = vi.fn();
    const client = { del } as unknown as Redis;
    const cache = new CacheService(client);

    await cache.del();

    expect(del).not.toHaveBeenCalled();
  });

  it('del forwards one or more keys', async () => {
    const del = vi.fn().mockResolvedValue(2);
    const client = { del } as unknown as Redis;
    const cache = new CacheService(client);

    await cache.del('a', 'b');

    expect(del).toHaveBeenCalledWith('a', 'b');
  });
});
