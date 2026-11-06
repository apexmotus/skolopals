/**
 * Phase 0 §6 / Phase 1's load-bearing proof: confirms that the
 * `set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE` pattern this
 * API's `applyRlsContext` (src/database/rls-context.ts) issues per
 * transaction makes Postgres RLS behave the same way it does for PostgREST
 * today — using the actual application code, not a hand-rolled imitation of
 * it.
 *
 * Runs against a local Postgres database built by `db/`'s `make reset`
 * (schema + RLS policies + the `anon`/`authenticated` role shim — see
 * db/local/00_roles.sql). Everything it inserts lives inside one
 * transaction that is always rolled back; it leaves no trace in the
 * database either way.
 *
 * Usage:
 *   DATABASE_URL=postgresql://$(whoami)@localhost:5432/skolopals_dev \
 *     pnpm exec tsx scripts/rls-spike.ts
 */
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { ClsService } from 'nestjs-cls';
import { applyRlsContext } from '../src/database/rls-context';
import type { AppClsStore } from '../src/common/types/app-cls-store';
import type { AuthUser } from '../src/common/types/auth-user';

function clsFor(actor: AuthUser | undefined): ClsService<AppClsStore> {
  const store: AppClsStore = { actor } as AppClsStore;
  return { get: () => store.actor } as unknown as ClsService<AppClsStore>;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  PASS  ${message}`);
}

async function asActor(
  client: PoolClient,
  actor: AuthUser | undefined,
  fn: () => Promise<void>,
): Promise<void> {
  await applyRlsContext(client, clsFor(actor));
  try {
    await fn();
  } finally {
    await client.query('RESET ROLE');
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      'Set DATABASE_URL to a local skolopals_dev connection string.',
    );

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  const guardianA = randomUUID();
  const guardianB = randomUUID();

  try {
    await client.query('BEGIN');

    // Fixtures, inserted as the connecting (superuser) role — exactly the
    // same shape test-rules.sh uses. A trigger on auth.users (people.sql)
    // auto-inserts the 'parent' public.user_roles row; no need to do it here.
    await client.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'spike-a@test', '{}'), ($2, 'spike-b@test', '{}')`,
      [guardianA, guardianB],
    );

    console.log(
      '=== anon: SELECT is granted (blanket grant to anon/authenticated), but RLS filters every row ===',
    );
    await asActor(client, undefined, async () => {
      const res = await client.query<{ user_id: string }>(
        'select user_id from public.user_roles',
      );
      assert(
        res.rows.length === 0,
        `anon's query succeeds but RLS returns 0 rows (saw ${res.rows.length})`,
      );
    });

    console.log(
      '=== authenticated guardian A: sees only their own role row ===',
    );
    await asActor(
      client,
      {
        id: guardianA,
        roles: ['parent'],
        claims: { sub: guardianA, role: 'authenticated' },
      },
      async () => {
        const res = await client.query<{ user_id: string }>(
          'select user_id from public.user_roles',
        );
        assert(
          res.rows.length === 1,
          `guardian A sees exactly 1 row (saw ${res.rows.length})`,
        );
        assert(
          res.rows[0]?.user_id === guardianA,
          "the row is guardian A's own row",
        );
      },
    );

    console.log(
      "=== authenticated guardian B: sees only THEIR own role row (not A's) ===",
    );
    await asActor(
      client,
      {
        id: guardianB,
        roles: ['parent'],
        claims: { sub: guardianB, role: 'authenticated' },
      },
      async () => {
        const res = await client.query<{ user_id: string }>(
          'select user_id from public.user_roles',
        );
        assert(
          res.rows.length === 1,
          `guardian B sees exactly 1 row (saw ${res.rows.length})`,
        );
        assert(
          res.rows[0]?.user_id === guardianB,
          "the row is guardian B's own row, not A's — RLS isolation holds",
        );
      },
    );

    console.log('\nAll RLS spike assertions passed.');
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
