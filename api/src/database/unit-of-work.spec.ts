import type { ClsService } from 'nestjs-cls';
import type { Pool, PoolClient } from 'pg';
import type { Mocked } from 'vitest';
import type { AppClsStore } from '../common/types/app-cls-store';
import { TransactionContext } from './transaction.context';
import { UnitOfWork } from './unit-of-work';

function makeClient(): Mocked<PoolClient> {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  } as unknown as Mocked<PoolClient>;
}

describe('UnitOfWork', () => {
  const cls = { get: () => undefined } as unknown as ClsService<AppClsStore>;

  it('commits and releases the connection when the callback succeeds', async () => {
    const client = makeClient();
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;
    const ctx = new TransactionContext();
    const uow = new UnitOfWork(pool, ctx, cls);

    const result = await uow.run(() => Promise.resolve('ok'));

    expect(result).toBe('ok');
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query).not.toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the connection, then rethrows, when the callback fails', async () => {
    const client = makeClient();
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;
    const ctx = new TransactionContext();
    const uow = new UnitOfWork(pool, ctx, cls);
    const failure = new Error('business rule violated');

    await expect(uow.run(() => Promise.reject(failure))).rejects.toBe(failure);

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('joins an ambient transaction instead of opening a second one', async () => {
    const client = makeClient();
    const pool = { connect: vi.fn() } as unknown as Pool;
    const ctx = new TransactionContext();
    const uow = new UnitOfWork(pool, ctx, cls);

    const result = await ctx.run(client, () =>
      uow.run(() => Promise.resolve('joined')),
    );

    expect(result).toBe('joined');
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
