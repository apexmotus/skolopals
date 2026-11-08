import type { ClsService } from 'nestjs-cls';
import { DatabaseError } from 'pg';
import type { Pool, PoolClient } from 'pg';
import type { Mock, Mocked } from 'vitest';
import type { AppClsStore } from '../common/types/app-cls-store.js';
import { p } from './sp-param.js';
import { StoredProcRunner } from './stored-proc.runner.js';
import { TransactionContext } from './transaction.context.js';

function makeClient(queryImpl: Mock): Mocked<PoolClient> {
  return {
    query: queryImpl,
    release: vi.fn(),
  } as unknown as Mocked<PoolClient>;
}

const cls = { get: () => undefined } as unknown as ClsService<AppClsStore>;

describe('StoredProcRunner', () => {
  it('calls a function with named-parameter syntax, in a BEGIN/RLS/COMMIT transaction', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: '1' }], rowCount: 1 });
    const client = makeClient(query);
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;
    const runner = new StoredProcRunner(pool, new TransactionContext(), cls);

    const result = await runner.execute('public.get_widget', [
      p.uuid('p_id', 'abc'),
    ]);

    expect(result.rows).toEqual([{ id: '1' }]);
    expect(query.mock.calls[0]?.[0]).toBe('BEGIN');
    expect(query.mock.calls[1]?.[0]).toContain('select set_config'); // applyRlsContext
    expect(query.mock.calls[3]).toEqual([
      'select * from public.get_widget(p_id := $1)',
      ['abc'],
    ]);
    expect(query.mock.calls[4]?.[0]).toBe('COMMIT');
  });

  it('rejects a function name that is not schema-qualified, mapped to a generic 500 (never a raw internal message)', async () => {
    const client = makeClient(vi.fn());
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;
    const runner = new StoredProcRunner(pool, new TransactionContext(), cls);

    await expect(runner.execute('drop_everything')).rejects.toMatchObject({
      status: 500,
    });
  });

  it('selectMany runs a literal SELECT against a table/view with positional params', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ role: 'parent' }, { role: 'tutor' }],
      rowCount: 2,
    });
    const client = makeClient(query);
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;
    const runner = new StoredProcRunner(pool, new TransactionContext(), cls);

    const rows = await runner.selectMany<{ role: string }>(
      'select role from public.user_roles where user_id = $1',
      ['user-1'],
    );

    expect(rows).toEqual([{ role: 'parent' }, { role: 'tutor' }]);
    expect(query.mock.calls[3]).toEqual([
      'select role from public.user_roles where user_id = $1',
      ['user-1'],
    ]);
  });

  it('selectOne returns undefined when nothing matches', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const client = makeClient(query);
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;
    const runner = new StoredProcRunner(pool, new TransactionContext(), cls);

    await expect(
      runner.selectOne('select 1 from public.nothing where id = $1', ['x']),
    ).resolves.toBeUndefined();
  });

  it('joins an ambient transaction instead of opening its own', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const client = makeClient(query);
    const pool = { connect: vi.fn() } as unknown as Pool;
    const ctx = new TransactionContext();
    const runner = new StoredProcRunner(pool, ctx, cls);

    await ctx.run(client, () => runner.selectMany('select 1', []));

    expect(pool.connect).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1); // no BEGIN/RLS/COMMIT — ambient transaction already set those up
  });

  it('retries once on a deadlock when retryOnDeadlock is set, then succeeds', async () => {
    const deadlock = Object.assign(
      new DatabaseError('deadlock detected', 0, 'error'),
      { code: '40P01' },
    );
    const query = vi
      .fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // set_config
      .mockResolvedValueOnce(undefined) // set local role
      .mockRejectedValueOnce(deadlock) // the actual call
      .mockResolvedValueOnce(undefined) // ROLLBACK after the failed attempt
      .mockResolvedValueOnce(undefined) // BEGIN (attempt 2)
      .mockResolvedValueOnce(undefined) // set_config
      .mockResolvedValueOnce(undefined) // set local role
      .mockResolvedValueOnce({ rows: [{ ok: true }], rowCount: 1 }) // the actual call succeeds
      .mockResolvedValueOnce(undefined); // COMMIT
    const client = makeClient(query);
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;
    const runner = new StoredProcRunner(pool, new TransactionContext(), cls);

    const rows = await runner.selectMany('select 1', [], {
      retryOnDeadlock: true,
    });

    expect(rows).toEqual([{ ok: true }]);
  });
});
