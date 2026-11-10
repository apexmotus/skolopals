import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleOptions {
  limit: number;
  ttlMs: number;
}

/** A route-specific rate limit stricter than the global default set in `main.ts`
 * (`@fastify/rate-limit`). Enforced by `ThrottleGuard`. */
export const Throttle = (limit: number, ttlMs: number): MethodDecorator =>
  SetMetadata(THROTTLE_KEY, { limit, ttlMs } satisfies ThrottleOptions);
