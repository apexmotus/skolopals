import type { StoredProcRunner } from '../../database/stored-proc.runner';
import { EnquiriesRepository } from './enquiries.repository';

function makeSp(overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {}): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    selectOne: vi.fn().mockResolvedValue(undefined),
    executeRaw: vi.fn().mockResolvedValue({ rows: [{ id: 'e1' }], rowCount: 1 }),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('EnquiriesRepository.submit', () => {
  it('never passes status/handled_by/converted_learner_id — the table defaults already satisfy the RLS insert check', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new EnquiriesRepository(makeSp({ executeRaw }));

    await repo.submit({ fullName: 'Jane', message: 'Hi' });

    const [sql] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(
      'insert into public.contact_enquiries (id, full_name, email, phone, topic, message, source, created_at)',
    );
    expect(sql).not.toContain('status');
  });

  it('never uses RETURNING — anon has no SELECT policy on this table, so RETURNING would fail even on a successful insert; the response is built from the known input instead', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new EnquiriesRepository(makeSp({ executeRaw }));

    const row = await repo.submit({ fullName: 'Jane', message: 'Hi' });

    const [sql] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('returning');
    expect(row.status).toBe('new');
    expect(row.full_name).toBe('Jane');
  });
});

describe('EnquiriesRepository.list', () => {
  it('filters by status only when one was supplied', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new EnquiriesRepository(makeSp({ selectMany }));

    await repo.list();
    await repo.list('new');

    const [firstSql] = selectMany.mock.calls[0] as [string, unknown[]];
    const [secondSql, secondValues] = selectMany.mock.calls[1] as [string, unknown[]];
    expect(firstSql).not.toContain('where');
    expect(secondSql).toContain('where status = $1');
    expect(secondValues).toEqual(['new']);
  });
});

describe('EnquiriesRepository.convert', () => {
  it('sets status to enrolled and only back-fills handled_at when it was still null', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [{ id: 'e1' }], rowCount: 1 });
    const repo = new EnquiriesRepository(makeSp({ executeRaw }));

    await repo.convert('e1', 'l1', 'admin-1');

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status = 'enrolled'");
    expect(sql).toContain('coalesce(handled_at, now())');
    expect(values).toEqual(['e1', 'l1', 'admin-1']);
  });
});
