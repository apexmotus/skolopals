import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, types } from 'pg';
import type { EnvConfig } from '../config/env.schema';
import { PG_POOL } from './database.constants';

/**
 * Postgres `date` (OID 1082) has no time-of-day or timezone component, but
 * `pg`'s default parser still converts it to a JS `Date` at **local**
 * midnight — so `.toISOString()` on it silently shifts by a day for any
 * non-UTC-0 host timezone (confirmed against this app's own `/reference/terms`
 * endpoint while sanity-checking Phase 3a: Africa/Johannesburg is UTC+2, so
 * `2027-01-13` round-tripped as `2027-01-12`). Disabling the parser for this
 * one OID makes `date` columns come back as the raw `'YYYY-MM-DD'` string
 * Postgres sent, which is the only representation a pure calendar date can
 * have without inventing a timezone for it. `timestamptz` is unaffected —
 * it's a real instant and `pg` parses it to a correct UTC-aware `Date`.
 */
types.setTypeParser(types.builtins.DATE, (value: string) => value);

/**
 * Direct Postgres connection to the existing Supabase project (port 5432,
 * session mode — never the 6543 transaction pooler; see
 * docs/nestjs-api-plan/04-phase0-schema-port-and-cutover-strategy.md §1).
 *
 * node-postgres's `Pool` has no `min` option (it opens connections lazily up
 * to `max` and closes idle ones after `idleTimeoutMillis`) — `DB_POOL_MIN` is
 * accepted in config for parity with the generic spec's table but isn't a
 * dial this provider has to turn.
 */
export const pgPoolProvider: Provider = {
  provide: PG_POOL,
  inject: [ConfigService],
  useFactory: async (config: ConfigService<EnvConfig, true>): Promise<Pool> => {
    const logger = new Logger('PgPool');
    const pool = new Pool({
      connectionString: config.getOrThrow('DATABASE_URL', { infer: true }),
      max: config.getOrThrow('DB_POOL_MAX', { infer: true }),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: config.getOrThrow('DB_CONNECTION_TIMEOUT_MS', {
        infer: true,
      }),
      statement_timeout: config.getOrThrow('DB_STATEMENT_TIMEOUT_MS', {
        infer: true,
      }),
      ssl: config.getOrThrow('DB_SSL', { infer: true })
        ? { rejectUnauthorized: false }
        : false,
    });
    pool.on('error', (err) => {
      logger.error(`Pool error: ${err.message}`);
    });

    // Fail fast at boot.
    const client = await pool.connect();
    try {
      await client.query('select 1');
    } finally {
      client.release();
    }
    logger.log('Connected to Postgres (Supabase direct connection)');
    return pool;
  },
};
