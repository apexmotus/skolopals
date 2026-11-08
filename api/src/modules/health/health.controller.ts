import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { Public } from '../../common/decorators/public.decorator.js';
import { RawResponse } from '../../common/decorators/raw-response.decorator.js';
import { PG_POOL } from '../../database/database.constants.js';
import { REDIS_CLIENT } from '../../common/redis/redis.constants.js';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('live')
  @Public()
  @RawResponse()
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('ready')
  @Public()
  @RawResponse()
  @HealthCheck()
  ready() {
    return this.health.check([
      // The only inline SQL in the whole codebase — generic spec §8.5.
      () =>
        this.indicators.check('postgres').attempt(async () => {
          await this.pool.query('select 1');
        }),
      () =>
        this.indicators.check('redis').attempt(async () => {
          await this.redis.ping();
        }),
    ]);
  }
}
