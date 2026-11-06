import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import { ClsService } from 'nestjs-cls';
import type { EnvConfig } from '../../config/env.schema';
import type { AppClsStore } from '../types/app-cls-store';
import type { AuthUser } from '../types/auth-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Verifies a Supabase-issued access token — this API never issues or
 * rotates one; see docs/nestjs-api-plan/06-phase2-auth.md. HS256 against
 * `SUPABASE_JWT_SECRET` is this project's documented default; confirm
 * against the Supabase dashboard's JWT settings before relying on this in
 * an environment that might have switched to asymmetric/JWKS signing.
 *
 * **Phase 2 follow-up, deliberately not done here**: `roles` is left `[]`.
 * There is no Postgres auth hook injecting roles into the token (confirmed
 * by grepping `db/migrations/` for one), so a real role list requires a
 * lookup against `public.user_roles` — which needs an actual repository
 * call once an `auth`/`people` module exists, not inline SQL from a guard
 * (hard rule: no inline SQL outside the health check). `RolesGuard` will
 * reject every `@Roles(...)`-gated route until that lookup is wired in
 * Phase 2; Phase 1 has no such routes yet, so this doesn't block anything
 * today.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthUser }>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException();
    }

    try {
      const claims = await this.jwtService.verifyAsync<Record<string, unknown>>(
        token,
        {
          secret: this.config.getOrThrow('SUPABASE_JWT_SECRET', {
            infer: true,
          }),
          algorithms: ['HS256'],
        },
      );
      const sub = claims.sub;
      if (typeof sub !== 'string') throw new Error('Token has no sub claim');

      const user: AuthUser = { id: sub, roles: [], claims };
      request.user = user;
      this.cls.set('actor', user);
      return true;
    } catch (err) {
      if (isPublic) return true; // best-effort: proceed anonymously rather than block a public route
      this.logger.debug(
        `Rejected token: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException();
    }
  }

  private extractToken(request: FastifyRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    return header.slice('Bearer '.length).trim() || undefined;
  }
}
