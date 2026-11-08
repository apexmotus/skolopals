import type { ClsService } from 'nestjs-cls';
import type { PoolClient } from 'pg';
import type { AppClsStore } from '../common/types/app-cls-store.js';

/**
 * Reproduces, per transaction, exactly what PostgREST does today before
 * running a user's query: set the decoded JWT claims as a session-scoped GUC
 * and switch role to `authenticated` — see
 * docs/nestjs-api-plan/04-phase0-schema-port-and-cutover-strategy.md §1.
 *
 * MUST be called as the first statement(s) after `BEGIN`, using `set_config`
 * with `is_local = true` and `SET LOCAL ROLE` — never the session-level
 * forms — because `pg.Pool` hands physical connections back to the pool for
 * reuse across unrelated requests; a session-level `SET ROLE` would leak
 * into whatever request is served next on that connection.
 *
 * An anonymous/public request (no `actor` in the CLS store) still needs
 * this: it runs as `anon` with empty claims, the same way PostgREST serves
 * an unauthenticated request, so RLS policies that check `auth.role() =
 * 'anon'` (e.g. the public timetable view) behave identically.
 */
export async function applyRlsContext(
  client: PoolClient,
  cls: ClsService<AppClsStore>,
): Promise<void> {
  const actor = cls.get('actor');
  const claimsJson = JSON.stringify(actor?.claims ?? {});
  const role = actor ? 'authenticated' : 'anon';
  await client.query('select set_config($1, $2, true)', [
    'request.jwt.claims',
    claimsJson,
  ]);
  // Role names can't be parameterised; `role` is constrained to the two
  // literals above, never user input.
  await client.query(`set local role ${role}`);
}
