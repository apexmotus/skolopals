import type { ClsService } from 'nestjs-cls';
import { escapeLiteral, type PoolClient } from 'pg';
import type { AppClsStore } from '../common/types/app-cls-store.js';

/**
 * Opens a transaction and reproduces, inside it, exactly what PostgREST does
 * before running a user's query: set the decoded JWT claims as a
 * transaction-scoped GUC and switch role to `authenticated` — see
 * docs/nestjs-api-plan/04-phase0-schema-port-and-cutover-strategy.md §1.
 *
 * Both settings use `set_config(..., true)` (the `is_local` form, equivalent
 * to `SET LOCAL`) — never the session-level forms — because `pg.Pool` hands
 * physical connections back to the pool for reuse across unrelated
 * requests; a session-level role switch would leak into whatever request is
 * served next on that connection.
 *
 * `BEGIN` and both settings go out as one simple-protocol, multi-statement
 * query: one network round trip instead of three, which matters because
 * every API call pays it and the database is a network hop away. The simple
 * protocol takes no `$n` parameters, so the claims JSON is inlined with
 * `pg.escapeLiteral` (the driver's own quoting, which handles quotes and
 * backslashes); the role is one of two literals below, never user input.
 *
 * An anonymous/public request (no `actor` in the CLS store) still needs
 * this: it runs as `anon` with empty claims, the same way PostgREST serves
 * an unauthenticated request, so RLS policies that check `auth.role() =
 * 'anon'` (e.g. the public timetable view) behave identically.
 */
export async function beginWithRlsContext(
  client: PoolClient,
  cls: ClsService<AppClsStore>,
): Promise<void> {
  await client.query(`begin; ${rlsSettingsSql(cls)}`);
}

/**
 * The RLS settings alone, for a caller that already holds an open
 * transaction and switches actor inside it (the `scripts/` smoke tests).
 */
export async function applyRlsContext(
  client: PoolClient,
  cls: ClsService<AppClsStore>,
): Promise<void> {
  await client.query(rlsSettingsSql(cls));
}

function rlsSettingsSql(cls: ClsService<AppClsStore>): string {
  const actor = cls.get('actor');
  const claimsJson = JSON.stringify(actor?.claims ?? {});
  const role = actor ? 'authenticated' : 'anon';
  return `select set_config('request.jwt.claims', ${escapeLiteral(claimsJson)}, true), set_config('role', '${role}', true)`;
}
