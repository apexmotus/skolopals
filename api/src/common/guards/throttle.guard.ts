import {
  CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { THROTTLE_KEY, type ThrottleOptions } from '../decorators/throttle.decorator.js';

/** Registered globally but a no-op unless the handler carries `@Throttle(...)` —
 * the app-wide default rate limit is `@fastify/rate-limit` in `main.ts`, not
 * this guard. Fixed-window counter in Redis, keyed per handler and client IP. */
@Injectable()
export class ThrottleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<ThrottleOptions | undefined>(
      THROTTLE_KEY,
      context.getHandler(),
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const key = `skolopals:throttle:${context.getClass().name}.${context.getHandler().name}:${request.ip}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.pexpire(key, options.ttlMs);
    if (count > options.limit) {
      throw new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
