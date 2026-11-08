import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

/**
 * Generic spec §8.6. Managers are the only layer allowed to call this —
 * Repositories never cache, Controllers never see it. Key format:
 * `<app>:<module>:<entity>:<id>`, built by each module's own key-builder
 * file (e.g. `reference/reference-cache-keys.ts`), never inline here.
 */
@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as T;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- documents call-site intent even though T isn't used in the return type
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.del(...keys);
  }
}
