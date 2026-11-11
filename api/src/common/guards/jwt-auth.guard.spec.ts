import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
} from 'jose';
import type { ClsService } from 'nestjs-cls';
import type { Mock } from 'vitest';
import type { EnvConfig } from '../../config/env.schema.js';
import type { UserRolesRepository } from '../../modules/auth/user-roles.repository.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SUPABASE_URL = 'https://project.supabase.co';
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const SECRET = 'a'.repeat(32);

function makeConfig(overrides: Partial<EnvConfig> = {}) {
  const values: Partial<EnvConfig> = {
    SUPABASE_URL,
    SUPABASE_JWT_SECRET: SECRET,
    ...overrides,
  };
  return {
    get: (key: keyof EnvConfig) => values[key],
    getOrThrow: (key: keyof EnvConfig) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing ${key}`);
      return value;
    },
  } as unknown as ConfigService<EnvConfig, true>;
}

function makeContext(headers: Record<string, string>, isPublic: boolean) {
  const request: Record<string, unknown> = { headers };
  const reflector = {
    getAllAndOverride: () => isPublic,
  } as unknown as Reflector;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, request, reflector };
}

describe('JwtAuthGuard', () => {
  let signingKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
  let jwks: JWTVerifyGetKey;
  let cls: { set: Mock };
  let userRoles: { listForUser: Mock };

  beforeAll(async () => {
    const pair = await generateKeyPair('ES256');
    signingKey = pair.privateKey;
    const jwk = await exportJWK(pair.publicKey);
    jwks = createLocalJWKSet({
      keys: [{ ...jwk, kid: 'current', alg: 'ES256', use: 'sig' }],
    });
  });

  beforeEach(() => {
    cls = { set: vi.fn() };
    userRoles = { listForUser: vi.fn().mockResolvedValue(['parent']) };
  });

  function makeGuard(
    reflector: Reflector,
    config = makeConfig(),
    keys: JWTVerifyGetKey = jwks,
  ): JwtAuthGuard {
    return new JwtAuthGuard(
      reflector,
      keys,
      config,
      cls as unknown as ClsService<never>,
      userRoles as unknown as UserRolesRepository,
    );
  }

  /** A token shaped like the ones Supabase mints with its asymmetric signing key. */
  function signEs256(claims: Record<string, unknown>, issuer = ISSUER) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: 'current' })
      .setIssuer(issuer)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(signingKey);
  }

  /** A token shaped like the ones a project still on the legacy shared secret mints. */
  function signHs256(
    claims: Record<string, unknown>,
    secret = SECRET,
    expiresIn = '1h',
  ) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(new TextEncoder().encode(secret));
  }

  it('allows an ES256 token signed by a JWKS key through and attaches the decoded actor', async () => {
    const token = await signEs256({ sub: 'user-1' });
    const { context, request, reflector } = makeContext(
      { authorization: `Bearer ${token}` },
      false,
    );
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'user-1', roles: ['parent'] });
    expect(cls.set).toHaveBeenCalledWith(
      'actor',
      expect.objectContaining({ id: 'user-1' }),
    );
    expect(userRoles.listForUser).toHaveBeenCalledWith('user-1');
  });

  it('allows an HS256 token signed with the legacy secret through', async () => {
    const token = await signHs256({ sub: 'user-1' });
    const { context, request, reflector } = makeContext(
      { authorization: `Bearer ${token}` },
      false,
    );
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'user-1' });
  });

  it('sets the CLS actor before looking up roles, so the lookup runs under the right RLS identity', async () => {
    const token = await signEs256({ sub: 'user-1' });
    const { context, reflector } = makeContext(
      { authorization: `Bearer ${token}` },
      false,
    );
    const guard = makeGuard(reflector);

    await guard.canActivate(context);

    const setOrder = cls.set.mock.invocationCallOrder[0] ?? Number.NaN;
    const lookupOrder =
      userRoles.listForUser.mock.invocationCallOrder[0] ?? Number.NaN;
    expect(Number.isNaN(setOrder) || Number.isNaN(lookupOrder)).toBe(false);
    expect(setOrder).toBeLessThan(lookupOrder);
  });

  it('rejects an ES256 token signed by a key the JWKS does not contain', async () => {
    const other = await generateKeyPair('ES256');
    const token = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'ES256', kid: 'current' })
      .setIssuer(ISSUER)
      .setExpirationTime('1h')
      .sign(other.privateKey);
    const { context, reflector } = makeContext(
      { authorization: `Bearer ${token}` },
      false,
    );
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token issued by a different Supabase project', async () => {
    const token = await signEs256(
      { sub: 'user-1' },
      'https://some-other-project.supabase.co/auth/v1',
    );
    const { context, reflector } = makeContext(
      { authorization: `Bearer ${token}` },
      false,
    );
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an HS256 token when no legacy secret is configured', async () => {
    const token = await signHs256({ sub: 'user-1' });
    const { context, reflector } = makeContext(
      { authorization: `Bearer ${token}` },
      false,
    );
    const guard = makeGuard(
      reflector,
      makeConfig({ SUPABASE_JWT_SECRET: undefined }),
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired token on a protected route', async () => {
    const token = await signHs256({ sub: 'user-1' }, SECRET, '-1s');
    const { context, reflector } = makeContext(
      { authorization: `Bearer ${token}` },
      false,
    );
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await signHs256({ sub: 'user-1' }, 'b'.repeat(32));
    const { context, reflector } = makeContext(
      { authorization: `Bearer ${token}` },
      false,
    );
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a protected route with no Authorization header', async () => {
    const { context, reflector } = makeContext({}, false);
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a malformed Authorization header', async () => {
    const { context, reflector } = makeContext(
      { authorization: 'NotBearer abc' },
      false,
    );
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lets a @Public() route through anonymously with no token', async () => {
    const { context, request, reflector } = makeContext({}, true);
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
    expect(cls.set).not.toHaveBeenCalled();
  });

  it('lets a @Public() route through anonymously when its token fails verification', async () => {
    const { context, request, reflector } = makeContext(
      { authorization: 'Bearer garbage' },
      true,
    );
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });
});
