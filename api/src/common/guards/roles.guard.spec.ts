import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(
  requiredRoles: string[] | undefined,
  userRoles: string[] | undefined,
) {
  const request = { user: userRoles ? { roles: userRoles } : undefined };
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as unknown as Reflector;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

describe('RolesGuard', () => {
  it('allows any request through when no @Roles() metadata is present', () => {
    const { context, reflector } = makeContext(undefined, undefined);
    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('allows a request through when the actor has at least one required role', () => {
    const { context, reflector } = makeContext(['admin', 'tutor'], ['tutor']);
    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('rejects a request when the actor has none of the required roles', () => {
    const { context, reflector } = makeContext(['admin'], ['parent']);
    expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('rejects an anonymous request on a role-gated route', () => {
    const { context, reflector } = makeContext(['admin'], undefined);
    expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(
      ForbiddenException,
    );
  });
});
