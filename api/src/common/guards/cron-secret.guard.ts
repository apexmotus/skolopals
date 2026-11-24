import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { EnvConfig } from '../../config/env.schema.js';

/**
 * For `@Public()` job endpoints called by Vercel Cron, which sends
 * `Authorization: Bearer <CRON_SECRET>`. With no secret configured every call
 * is refused, so a missing variable fails closed.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get('CRON_SECRET', { infer: true });
    const header = context.switchToHttp().getRequest<FastifyRequest>().headers.authorization ?? '';
    const expected = Buffer.from(`Bearer ${secret ?? ''}`);
    const given = Buffer.from(header);
    if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected))
      throw new UnauthorizedException();
    return true;
  }
}
