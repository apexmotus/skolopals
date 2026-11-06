import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DatabaseError, type Pool, type QueryResultRow } from 'pg';
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
  /** Retry on a transient conflict (deadlock/serialization failure). Only honoured outside an ambient transaction. Default false; set true for idempotent functions. */
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
 * Postgres adaptation of the generic spec's §5.7 `StoredProcRunner`. Calls a
 * Postgres function with named-parameter syntax (never positional — a
 * reordering in the catalogue can't silently swap values) and, per
 * docs/nestjs-api-plan/04-phase0-schema-port-and-cutover-strategy.md §1,
 * **always** runs inside an explicit transaction with the RLS GUCs set as
 * the first statements — for every call, read or write, not just writes.
 *
 * When called from inside a `UnitOfWork.run()` block, it joins that ambient
 * transaction instead (the GUCs are already set for its duration); it never
 * opens a second one.
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
    const maxAttempts = opts.retryOnDeadlock && !this.txCtx.current ? 3 : 1;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.executeOnce<T>(fnName, params);
      } catch (err) {
        const isTransientConflict =
          err instanceof DatabaseError &&
          (err.code === '40P01' || err.code === '40001');
        if (isTransientConflict && attempt < maxAttempts) {
          this.logger.warn(`Transient conflict on ${fnName}, retry ${attempt}`);
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
          continue;
        }
        throw SqlErrorMapper.map(err, fnName);
      }
    }
  }

  private async executeOnce<T extends QueryResultRow>(
    fnName: string,
    params: SpParam[],
  ): Promise<SpResult<T>> {
    const sql = buildCallSql(fnName, params);
    const values = params.map((prm) => prm.value);

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
      try {
        await client.query('ROLLBACK');
      } catch {
        /* connection may already be broken; nothing more to roll back */
      }
      throw err;
    } finally {
      client.release();
    }
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
}
