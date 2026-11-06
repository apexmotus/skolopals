import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { Pool } from 'pg';
import type { AppClsStore } from '../common/types/app-cls-store';
import { PG_POOL } from './database.constants';
import { applyRlsContext } from './rls-context';
import { TransactionContext } from './transaction.context';

/**
 * Multi-SP write flows. Managers wrap them in `this.uow.run(async () => {
 * ... })`; inside, SP calls via `StoredProcRunner` MUST be awaited
 * sequentially (never `Promise.all`), because a transaction pins a single
 * Postgres connection — see the generic spec §5.5's usage rule, unchanged
 * here.
 *
 * `StoredProcRunner` needs no special-casing for "am I inside a
 * `UnitOfWork`?": it always checks `TransactionContext.current` first, and
 * only opens its own ad-hoc transaction when there isn't one already.
 */
@Injectable()
export class UnitOfWork {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly ctx: TransactionContext,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.ctx.current) return fn(); // join the ambient transaction

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await applyRlsContext(client, this.cls);
      const result = await this.ctx.run(client, fn);
      await client.query('COMMIT');
      return result;
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
}
