import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthUser } from '../types/auth-user.js';

/** The actor `JwtAuthGuard` attached to the request. `undefined` on a `@Public()` route with no token. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthUser }>();
    return request.user;
  },
);
