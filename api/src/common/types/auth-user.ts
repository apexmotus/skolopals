/**
 * The authenticated actor, decoded from a Supabase-issued JWT by
 * `JwtAuthGuard`. `claims` is the full decoded payload, forwarded verbatim —
 * never reshaped or renamed — into `set_config('request.jwt.claims', ...)`
 * so Postgres's `auth.jwt()` sees exactly what PostgREST would have given it.
 * See docs/nestjs-api-plan/04-phase0-schema-port-and-cutover-strategy.md §1
 * and 06-phase2-auth.md.
 */
export interface AuthUser {
  /** Supabase `auth.users.id` (the JWT's `sub` claim). */
  id: string;
  /** From `public.user_roles`, looked up per-request — see 06-phase2-auth.md. */
  roles: string[];
  claims: Record<string, unknown>;
}
