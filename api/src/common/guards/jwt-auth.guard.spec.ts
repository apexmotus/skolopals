import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ClsService } from 'nestjs-cls';
import type { Mock } from 'vitest';
import type { EnvConfig } from '../../config/env.schema';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'a'.repeat(32);

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
  const jwtService = new JwtService({});
  const config = { getOrThrow: () => SECRET } as unknown as ConfigService<
    EnvConfig,
    true
  >;
  let cls: { set: Mock };

  beforeEach(() => {
    cls = { set: vi.fn() };
  });

  function makeGuard(reflector: Reflector): JwtAuthGuard {
    return new JwtAuthGuard(
      reflector,
      jwtService,
      config,
      cls as unknown as ClsService<never>,
    );
  }

  it('allows a valid token through and attaches the decoded actor', async () => {
    const token = jwtService.sign(
      { sub: 'user-1' },
      { secret: SECRET, algorithm: 'HS256' },
    );
    const { context, request, reflector } = makeContext(
      { authorization: `Bearer ${token}` },
      false,
    );
    const guard = makeGuard(reflector);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'user-1', roles: [] });
    expect(cls.set).toHaveBeenCalledWith(
      'actor',
      expect.objectContaining({ id: 'user-1' }),
    );
  });

  it('rejects an expired token on a protected route', async () => {
    const token = jwtService.sign(
      { sub: 'user-1' },
      { secret: SECRET, algorithm: 'HS256', expiresIn: -1 },
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

  it('rejects a token signed with the wrong secret', async () => {
    const token = jwtService.sign(
      { sub: 'user-1' },
      { secret: 'b'.repeat(32), algorithm: 'HS256' },
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
