import {
  CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import {
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { ClsService } from 'nestjs-cls';
import type { EnvConfig } from '../../config/env.schema.js';
import { UserRolesRepository } from '../../modules/auth/user-roles.repository.js';
import type { AppClsStore } from '../types/app-cls-store.js';
import type { AuthUser } from '../types/auth-user.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { SUPABASE_JWKS, supabaseAuthIssuer } from './supabase-jwks.provider.js';

/** Supabase's asymmetric signing-key algorithms (dashboard → JWT Keys). */
const ASYMMETRIC_ALGORITHMS = ['ES256', 'RS256'];

/**
 * Verifies a Supabase-issued access token — this API never issues or
 * rotates one; see docs/nestjs-api-plan/06-phase2-auth.md.
 *
 * Supabase projects now sign tokens with an asymmetric key (ES256 by default)
 * whose public half is served from the project's JWKS endpoint; that is the
 * primary path here (`SUPABASE_JWKS`). A project still on — or rolled back to —
 * the legacy shared secret signs HS256, which is accepted only when
 * `SUPABASE_JWT_SECRET` is configured. Either way the token's `iss` must be
 * this project's `<SUPABASE_URL>/auth/v1`, so a token minted by some other
 * Supabase project (a stale web env pointing at an old project, say) is
 * rejected even if it is otherwise well-formed.
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
  private readonly issuer: string;
  private readonly hs256Secret: Uint8Array | undefined;

  constructor(
    private readonly reflector: Reflector,
    @Inject(SUPABASE_JWKS) private readonly jwks: JWTVerifyGetKey,
    config: ConfigService<EnvConfig, true>,
    private readonly cls: ClsService<AppClsStore>,
    private readonly userRoles: UserRolesRepository,
  ) {
    this.issuer = supabaseAuthIssuer(
      config.getOrThrow('SUPABASE_URL', { infer: true }),
    );
    const secret = config.get('SUPABASE_JWT_SECRET', { infer: true });
    this.hs256Secret = secret ? new TextEncoder().encode(secret) : undefined;
  }

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
      const claims = await this.verifyClaims(token);
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

  private async verifyClaims(token: string): Promise<JWTPayload> {
    const { alg } = decodeProtectedHeader(token);

    if (alg === 'HS256') {
      if (!this.hs256Secret) {
        throw new Error(
          'HS256 token received but SUPABASE_JWT_SECRET is not configured',
        );
      }
      const { payload } = await jwtVerify(token, this.hs256Secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
      });
      return payload;
    }

    const { payload } = await jwtVerify(token, this.jwks, {
      algorithms: ASYMMETRIC_ALGORITHMS,
      issuer: this.issuer,
    });
    return payload;
  }

  private extractToken(request: FastifyRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    return header.slice('Bearer '.length).trim() || undefined;
  }
}
