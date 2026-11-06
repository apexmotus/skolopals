import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * Postgres adaptation of the generic spec's §5.5 `TransactionContext`: a
 * `sql.Transaction` there is a checked-out `PoolClient` with an open `BEGIN`
 * here. Whoever is holding the ambient transaction (`UnitOfWork.run`, or
 * `StoredProcRunner` opening its own single-call transaction) is also the
 * only one who may `COMMIT`/`ROLLBACK`/`release` it.
 */
@Injectable()
export class TransactionContext {
  private readonly als = new AsyncLocalStorage<PoolClient>();

  get current(): PoolClient | undefined {
    return this.als.getStore();
  }

  run<T>(client: PoolClient, fn: () => Promise<T>): Promise<T> {
    return this.als.run(client, fn);
  }
}
