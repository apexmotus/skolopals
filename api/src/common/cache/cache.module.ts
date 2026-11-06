import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/** Imported directly by whichever feature module needs it (not global — RedisModule, which this depends on, already is). */
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
