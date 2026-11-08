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
import type { EnvConfig } from '../../config/env.schema.js';
import { UserRolesRepository } from '../../modules/auth/user-roles.repository.js';
import type { AppClsStore } from '../types/app-cls-store.js';
import type { AuthUser } from '../types/auth-user.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Verifies a Supabase-issued access token — this API never issues or
 * rotates one; see docs/nestjs-api-plan/06-phase2-auth.md. HS256 against
 * `SUPABASE_JWT_SECRET` is this project's documented default; confirm
 * against the Supabase dashboard's JWT settings before relying on this in
 * an environment that might have switched to asymmetric/JWKS signing.
 *
 * Roles come from a `public.user_roles` lookup (`UserRolesRepository`) —
 * confirmed there is no Postgres auth hook injecting them into the token
 * (grepped `db/migrations/` for one; see 06-phase2-auth.md item 1). The CLS
 * actor is set *before* that lookup runs, because the lookup itself goes
 * through `StoredProcRunner`/RLS and needs `auth.uid()` to already resolve
 * to this actor's `sub`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly cls: ClsService<AppClsStore>,
    private readonly userRoles: UserRolesRepository,
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

    const user = await this.verify(token);
    if (!user) {
      if (isPublic) return true; // best-effort: proceed anonymously rather than block a public route
      throw new UnauthorizedException();
    }

    request.user = user;
    this.cls.set('actor', user);
    user.roles = await this.userRoles.listForUser(user.id);
    return true;
  }

  private async verify(token: string): Promise<AuthUser | undefined> {
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
      return { id: sub, roles: [], claims };
    } catch (err) {
      this.logger.debug(
        `Rejected token: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  private extractToken(request: FastifyRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    return header.slice('Bearer '.length).trim() || undefined;
  }
}
