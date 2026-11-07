import type { SpParam } from '../../database/sp-param';
import type { StoredProcRunner } from '../../database/stored-proc.runner';
import { BillingRepository } from './billing.repository';

function makeSp(
  overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {},
): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    selectOne: vi.fn().mockResolvedValue(undefined),
    executeRaw: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    queryOne: vi.fn().mockResolvedValue(undefined),
    queryMany: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('BillingRepository.runMonthly', () => {
  it('omits p_period entirely when not supplied, so the function\'s own default resolves it', async () => {
    const queryMany = vi.fn().mockResolvedValue([]);
    const repo = new BillingRepository(makeSp({ queryMany }));

    await repo.runMonthly();

    const [fnName, params] = queryMany.mock.calls[0] as [string, SpParam[]];
    expect(fnName).toBe('public.run_monthly_invoices');
    expect(params).toEqual([]);
  });

  it('passes p_period when a period was supplied', async () => {
    const queryMany = vi.fn().mockResolvedValue([]);
    const repo = new BillingRepository(makeSp({ queryMany }));

    await repo.runMonthly('2026-12-01');

    const [, params] = queryMany.mock.calls[0] as [string, SpParam[]];
    expect(params).toEqual([{ name: 'p_period', value: '2026-12-01' }]);
  });
});

describe('BillingRepository.applyLateFees', () => {
  it('omits p_on entirely when not supplied', async () => {
    const queryOne = vi.fn().mockResolvedValue({ apply_late_fees: 0 });
    const repo = new BillingRepository(makeSp({ queryOne }));

    await repo.applyLateFees();

    const [fnName, params] = queryOne.mock.calls[0] as [string, SpParam[]];
    expect(fnName).toBe('public.apply_late_fees');
    expect(params).toEqual([]);
  });
});

describe('BillingRepository.recordPayment', () => {
  it('always passes p_reference as a real string, never null, since the function\'s own default is text', async () => {
    const queryOne = vi.fn().mockResolvedValue({ record_payment: 'pay-1' });
    const repo = new BillingRepository(makeSp({ queryOne }));

    await repo.recordPayment({
      billingAccountId: 'ba-1',
      amountCents: 1000,
      method: 'eft',
    });

    const [fnName, params] = queryOne.mock.calls[0] as [string, SpParam[]];
    expect(fnName).toBe('public.record_payment');
    expect(params.find((prm) => prm.name === 'p_reference')?.value).toBe('');
  });

  it('omits p_paid_on entirely when not supplied, so the function\'s own current_date default resolves it', async () => {
    const queryOne = vi.fn().mockResolvedValue({ record_payment: 'pay-1' });
    const repo = new BillingRepository(makeSp({ queryOne }));

    await repo.recordPayment({ billingAccountId: 'ba-1', amountCents: 1000, method: 'eft' });

    const [, params] = queryOne.mock.calls[0] as [string, SpParam[]];
    expect(params.some((prm) => prm.name === 'p_paid_on')).toBe(false);
  });

  it('passes p_paid_on when a date was supplied', async () => {
    const queryOne = vi.fn().mockResolvedValue({ record_payment: 'pay-1' });
    const repo = new BillingRepository(makeSp({ queryOne }));

    await repo.recordPayment({
      billingAccountId: 'ba-1',
      amountCents: 1000,
      method: 'eft',
      paidOn: '2026-11-07',
    });

    const [, params] = queryOne.mock.calls[0] as [string, SpParam[]];
    expect(params.find((prm) => prm.name === 'p_paid_on')?.value).toBe('2026-11-07');
  });
});

describe('BillingRepository invoice reads — RLS does the ownership filtering, no WHERE on guardian/role', () => {
  it('getInvoiceById joins v_invoice_status and embeds lines via json_agg, scoped only by invoice id', async () => {
    const selectOne = vi.fn().mockResolvedValue(undefined);
    const repo = new BillingRepository(makeSp({ selectOne }));

    await repo.getInvoiceById('inv-1');

    const [sql, values] = selectOne.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('join public.v_invoice_status v on v.id = i.id');
    expect(sql).toContain('json_agg');
    expect(sql).toContain('where i.id = $1');
    expect(values).toEqual(['inv-1']);
  });

  it('listInvoices scopes by billing_account_id, newest first', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new BillingRepository(makeSp({ selectMany }));

    await repo.listInvoices('ba-1');

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('where i.billing_account_id = $1');
    expect(sql).toContain('order by i.issued_on desc');
    expect(values).toEqual(['ba-1']);
  });
});

describe('BillingRepository credit notes — two writes, both must run inside the caller\'s UnitOfWork', () => {
  it('createCreditNote inserts and returns the new id', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [{ id: 'cn-1' }], rowCount: 1 });
    const repo = new BillingRepository(makeSp({ executeRaw }));

    const id = await repo.createCreditNote({
      billingAccountId: 'ba-1',
      amountCents: 1000,
      reason: 'Waived',
      issuedBy: 'admin-1',
    });

    expect(id).toBe('cn-1');
    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert into public.credit_notes');
    expect(values).toEqual(['ba-1', 1000, 'Waived', 'admin-1']);
  });

  it('allocateCreditNote inserts the allocation row', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new BillingRepository(makeSp({ executeRaw }));

    await repo.allocateCreditNote('cn-1', 'inv-1', 1000);

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert into public.credit_note_allocations');
    expect(values).toEqual(['cn-1', 'inv-1', 1000]);
  });
});

describe('BillingRepository.getOutstanding', () => {
  it('reads v_outstanding_fees with no actor-scoping WHERE — admin-only is enforced by the controller role guard', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new BillingRepository(makeSp({ selectMany }));

    await repo.getOutstanding();

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[] | undefined];
    expect(sql).toContain('from public.v_outstanding_fees');
    expect(values ?? []).toEqual([]);
  });
});
