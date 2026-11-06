import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import {
  DatabaseError,
  type Pool,
  type PoolClient,
  type QueryResultRow,
} from 'pg';
import type { AppClsStore } from '../common/types/app-cls-store';
import { PG_POOL } from './database.constants';
import { applyRlsContext } from './rls-context';
import type { SpParam } from './sp-param';
import { SqlErrorMapper } from './sql-error.mapper';
import { TransactionContext } from './transaction.context';

export interface SpResult<T> {
  rows: T[];
  rowCount: number;
}

export interface ExecOptions {
  /** Retry on a transient conflict (deadlock/serialization failure). Only honoured outside an ambient transaction. Default false; set true for idempotent functions/reads. */
  retryOnDeadlock?: boolean;
}

/** `public.submit_enrolment`, `private.check_programme_capacity` — schema-qualified, nothing else. */
const SAFE_FN_NAME = /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/;

function buildCallSql(fnName: string, params: readonly SpParam[]): string {
  if (!SAFE_FN_NAME.test(fnName)) {
    throw new Error(
      `Refusing to call "${fnName}": not a schema-qualified function name.`,
    );
  }
  const args = params.map((prm, i) => `${prm.name} := $${i + 1}`).join(', ');
  return `select * from ${fnName}(${args})`;
}

/**
 * Postgres adaptation of the generic spec's §5.7 `StoredProcRunner`. Per
 * docs/nestjs-api-plan/04-phase0-schema-port-and-cutover-strategy.md §1,
 * **every** call — read or write, function or table — runs inside an
 * explicit transaction with the RLS GUCs set as the first statements.
 *
 * When called from inside a `UnitOfWork.run()` block, it joins that ambient
 * transaction instead (the GUCs are already set for its duration); it never
 * opens a second one.
 *
 * Two call shapes, both going through the same transaction/RLS wrapping:
 * - `execute`/`queryOne`/`queryMany`/`queryPaged`/`executeNonQuery` call a
 *   Postgres **function** with named-parameter syntax (never positional —
 *   a reordering in the catalogue can't silently swap values).
 * - `selectOne`/`selectMany`/`executeRaw` run a **literal, Repository-authored
 *   SQL statement** against an RLS-protected table or view. This project's
 *   schema exposes most plain reads *and* many simple writes this way (the
 *   same thing PostgREST does via `.from(table).select()/.insert()/.update()`
 *   today — confirmed against `web/src/lib/auth.ts` and `02-sp-catalogue.md`'s
 *   Auth section, which explicitly says the roles lookup "is just the
 *   ordinary people/users read path... not a special auth-module SP")
 *   rather than wrapping every read/write in a function that doesn't
 *   otherwise exist. The "no inline SQL" hard rule is about never building
 *   a query from untrusted input in a Manager/Controller — `sql` here is
 *   always a `const` literal in a `*.repository.ts` file, parameters are
 *   always placeholders, exactly like a function call.
 */
@Injectable()
export class StoredProcRunner {
  private readonly logger = new Logger(StoredProcRunner.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly txCtx: TransactionContext,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async execute<T extends QueryResultRow = QueryResultRow>(
    fnName: string,
    params: SpParam[] = [],
    opts: ExecOptions = {},
  ): Promise<SpResult<T>> {
    return this.runWithRetry(fnName, opts, () =>
      this.runQuery<T>(
        buildCallSql(fnName, params),
        params.map((p) => p.value),
      ),
    );
  }

  /** First row, or undefined. */
  async queryOne<T extends QueryResultRow>(
    fnName: string,
    params: SpParam[] = [],
    opts?: ExecOptions,
  ): Promise<T | undefined> {
    const r = await this.execute<T>(fnName, params, opts);
    return r.rows[0];
  }

  /** All rows. */
  async queryMany<T extends QueryResultRow>(
    fnName: string,
    params: SpParam[] = [],
    opts?: ExecOptions,
  ): Promise<T[]> {
    const r = await this.execute<T>(fnName, params, opts);
    return r.rows;
  }

  /**
   * Paged read. Convention for this project (Postgres has no two-recordset
   * equivalent of the generic spec's SQL Server pattern): every row of a
   * paginated list function carries a `total_count bigint` column, produced
   * with `count(*) over()`. Document this when a Phase 3 module designs or
   * audits a list function.
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- intentional: callers pin their own Row type, as with queryOne/queryMany above
  async queryPaged<T extends QueryResultRow & { total_count: string | number }>(
    fnName: string,
    params: SpParam[] = [],
    opts?: ExecOptions,
  ): Promise<{ rows: T[]; totalCount: number }> {
    const r = await this.execute<T>(fnName, params, opts);
    const firstRow = r.rows[0];
    const totalCount = firstRow ? Number(firstRow.total_count) : 0;
    return { rows: r.rows, totalCount };
  }

  /** Write with no meaningful result set. */
  async executeNonQuery(
    fnName: string,
    params: SpParam[] = [],
    opts?: ExecOptions,
  ): Promise<{ rowCount: number }> {
    const r = await this.execute(fnName, params, opts);
    return { rowCount: r.rowCount };
  }

  /** First row of a literal, Repository-authored SELECT against a table/view, or undefined. */
  async selectOne<T extends QueryResultRow>(
    sql: string,
    values: unknown[] = [],
    opts?: ExecOptions,
  ): Promise<T | undefined> {
    const r = await this.runWithRetry(sql, opts ?? {}, () =>
      this.runQuery<T>(sql, values),
    );
    return r.rows[0];
  }

  /** All rows of a literal, Repository-authored SELECT against a table/view. */
  async selectMany<T extends QueryResultRow>(
    sql: string,
    values: unknown[] = [],
    opts?: ExecOptions,
  ): Promise<T[]> {
    const r = await this.runWithRetry(sql, opts ?? {}, () =>
      this.runQuery<T>(sql, values),
    );
    return r.rows;
  }

  /**
   * A literal, Repository-authored INSERT/UPDATE/DELETE against a table —
   * for the many writes in this schema that are plain parameterized DML
   * under RLS/grants (no dedicated function exists; see `02-sp-catalogue.md`'s
   * outstanding audit), e.g. `insert into public.rooms (...) values (...)
   * returning *`. Same transaction/RLS wrapping as everything else.
   */
  async executeRaw<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values: unknown[] = [],
    opts?: ExecOptions,
  ): Promise<SpResult<T>> {
    return this.runWithRetry(sql, opts ?? {}, () =>
      this.runQuery<T>(sql, values),
    );
  }

  private async runWithRetry<T extends QueryResultRow>(
    label: string,
    opts: ExecOptions,
    fn: () => Promise<SpResult<T>>,
  ): Promise<SpResult<T>> {
    const maxAttempts = opts.retryOnDeadlock && !this.txCtx.current ? 3 : 1;
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const isTransientConflict =
          err instanceof DatabaseError &&
          (err.code === '40P01' || err.code === '40001');
        if (isTransientConflict && attempt < maxAttempts) {
          this.logger.warn(`Transient conflict on ${label}, retry ${attempt}`);
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
          continue;
        }
        throw SqlErrorMapper.map(err, label);
      }
    }
  }

  private async runQuery<T extends QueryResultRow>(
    sql: string,
    values: unknown[],
  ): Promise<SpResult<T>> {
    const ambient = this.txCtx.current;
    if (ambient) {
      const res = await ambient.query<T>(sql, values);
      return { rows: res.rows, rowCount: res.rowCount ?? 0 };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await applyRlsContext(client, this.cls);
      const res = await client.query<T>(sql, values);
      await client.query('COMMIT');
      return { rows: res.rows, rowCount: res.rowCount ?? 0 };
    } catch (err) {
      await this.rollbackSafely(client);
      throw err;
    } finally {
      client.release();
    }
  }

  private async rollbackSafely(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection may already be broken; nothing more to roll back */
    }
  }
}
