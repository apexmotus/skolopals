import type { ClsStore } from 'nestjs-cls';
import type { AuthUser } from './auth-user';

/**
 * Per-request context, propagated via `nestjs-cls` (AsyncLocalStorage under
 * the hood) from `JwtAuthGuard` all the way down to `StoredProcRunner`. This
 * is the one channel the RLS pattern in phase0 §1 depends on: the guard sets
 * `actor` once per request (or leaves it unset for a public/anonymous
 * request), and the database layer reads it to decide the Postgres role and
 * `request.jwt.claims` for every call, read or write.
 *
 * Deliberately not hand-rolled with a bare `AsyncLocalStorage` — propagating
 * context correctly across Fastify's hook chain + Nest's guard/interceptor
 * pipeline is exactly the kind of subtle bug phase0 §1 flags as the single
 * biggest risk in this pivot, and `nestjs-cls`'s middleware-mounted setup is
 * the well-tested way to get that right.
 */
export interface AppClsStore extends ClsStore {
  actor?: AuthUser;
}
