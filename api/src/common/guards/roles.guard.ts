import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthUser } from '../types/auth-user.js';

/** Registered after `JwtAuthGuard`. No `@Roles(...)` on the route = any authenticated (or public) user is allowed through. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      string[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthUser }>();
    const hasMatch = requiredRoles.some((role) =>
      request.user?.roles.includes(role),
    );
    if (!hasMatch) throw new ForbiddenException();
    return true;
  }
}
