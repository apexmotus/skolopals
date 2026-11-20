import type { ClsService } from 'nestjs-cls';
import type { PoolClient } from 'pg';
import type { AppClsStore } from '../common/types/app-cls-store.js';
import { beginWithRlsContext } from './rls-context.js';

function makeClient() {
  const query = vi.fn().mockResolvedValue(undefined);
  return { client: { query } as unknown as PoolClient, query };
}

describe('beginWithRlsContext', () => {
  it('runs anonymous requests as anon with empty claims, in one round trip', async () => {
    const { client, query } = makeClient();
    const cls = { get: () => undefined } as unknown as ClsService<AppClsStore>;

    await beginWithRlsContext(client, cls);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      "begin; select set_config('request.jwt.claims', '{}', true), set_config('role', 'anon', true)",
    );
  });

  it('runs signed-in requests as authenticated, with quotes in the claims escaped', async () => {
    const { client, query } = makeClient();
    const claims = { sub: 'u-1', name: "O'Brien'); drop table x; --" };
    const cls = {
      get: () => ({ claims }),
    } as unknown as ClsService<AppClsStore>;

    await beginWithRlsContext(client, cls);

    const sql = query.mock.calls[0]?.[0] as string;
    expect(sql).toContain(`'${JSON.stringify(claims).replace(/'/g, "''")}'`);
    expect(sql).toMatch(/set_config\('role', 'authenticated', true\)$/);
  });
});
