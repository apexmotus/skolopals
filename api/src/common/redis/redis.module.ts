import { Global, Logger, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { EnvConfig } from '../../config/env.schema.js';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisShutdownService } from './redis-shutdown.service.js';

const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService<EnvConfig, true>): Redis => {
    const logger = new Logger('Redis');
    const client = new Redis(config.getOrThrow('REDIS_URL', { infer: true }), {
      lazyConnect: false,
    });
    client.on('error', (err) => {
      logger.error(`Redis error: ${err.message}`);
    });
    return client;
  },
};

/**
 * Caching per 01-app-definition.md §1.2 (public reference data, tutor
 * directory). The `CacheService` wrapper Managers actually call (generic
 * spec §8.6) lands in Phase 3 with the first module that needs it; this
 * module only provides the shared client and its health/shutdown wiring,
 * which Phase 1's health check and Docker setup depend on now.
 */
@Global()
@Module({
  providers: [redisClientProvider, RedisShutdownService],
  exports: [redisClientProvider],
})
export class RedisModule {}
