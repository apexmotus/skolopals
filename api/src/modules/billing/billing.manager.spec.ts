import { NotFoundException } from '@nestjs/common';
import type { UnitOfWork } from '../../database/unit-of-work';
import { BillingManager } from './billing.manager';
import type { BillingRepository } from './billing.repository';

function makeUow(): UnitOfWork {
  return {
    run: vi.fn((fn: () => Promise<unknown>) => fn()),
  } as unknown as UnitOfWork;
}

const ACCOUNT_ROW = {
  id: 'ba-1',
  guardian_id: 'guardian-1',
  status: 'active',
  created_at: new Date('2026-01-01T00:00:00Z'),
};

const INVOICE_ROW = {
  id: 'inv-1',
  billing_account_id: 'ba-1',
  invoice_number: 'SKP-2026-0001',
  period_start: '2026-11-01',
  period_end: '2026-11-30',
  issued_on: '2026-10-15',
  due_on: '2026-11-01',
  status: 'issued',
  notes: '',
  created_at: new Date('2026-10-15T00:00:00Z'),
  total_cents: '75000',
  settled_cents: '0',
  balance_cents: '75000',
  payment_state: 'unpaid',
  days_overdue: 0,
  lines: [],
};

describe('BillingManager — ownership/visibility 404s', () => {
  it('getMine 404s when the guardian has no billing account yet (never billed before)', async () => {
    const repo = {
      getBillingAccountByGuardian: vi.fn().mockResolvedValue(undefined),
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    await expect(
      manager.getMine({ id: 'guardian-1', roles: ['parent'], claims: {} }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getById 404s when RLS hid the account (not the owner, not admin)', async () => {
    const repo = {
      getBillingAccountById: vi.fn().mockResolvedValue(undefined),
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    await expect(manager.getById('ba-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getById returns the mapped account when it is visible', async () => {
    const repo = {
      getBillingAccountById: vi.fn().mockResolvedValue(ACCOUNT_ROW),
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    const dto = await manager.getById('ba-1');

    expect(dto).toEqual({
      id: 'ba-1',
      guardianId: 'guardian-1',
      status: 'active',
      createdAt: ACCOUNT_ROW.created_at,
    });
  });

  it('getStatement 404s on an invisible account instead of returning an ambiguous empty list', async () => {
    const getStatement = vi.fn();
    const repo = {
      getBillingAccountById: vi.fn().mockResolvedValue(undefined),
      getStatement,
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    await expect(manager.getStatement('ba-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(getStatement).not.toHaveBeenCalled();
  });

  it('listInvoices 404s on an invisible account instead of returning an ambiguous empty list', async () => {
    const listInvoices = vi.fn();
    const repo = {
      getBillingAccountById: vi.fn().mockResolvedValue(undefined),
      listInvoices,
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    await expect(manager.listInvoices('ba-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(listInvoices).not.toHaveBeenCalled();
  });

  it('listPayments 404s on an invisible account instead of returning an ambiguous empty list', async () => {
    const listPayments = vi.fn();
    const repo = {
      getBillingAccountById: vi.fn().mockResolvedValue(undefined),
      listPayments,
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    await expect(manager.listPayments('ba-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(listPayments).not.toHaveBeenCalled();
  });

  it('getInvoiceById 404s when the invoice does not exist (or RLS hid it)', async () => {
    const repo = {
      getInvoiceById: vi.fn().mockResolvedValue(undefined),
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    await expect(manager.getInvoiceById('inv-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('BillingManager — bigint/numeric view columns parsed to number', () => {
  it('getInvoiceById parses total/settled/balance cents from the string pg returns for bigint columns', async () => {
    const repo = {
      getInvoiceById: vi.fn().mockResolvedValue(INVOICE_ROW),
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    const dto = await manager.getInvoiceById('inv-1');

    expect(dto.totalCents).toBe(75000);
    expect(dto.settledCents).toBe(0);
    expect(dto.balanceCents).toBe(75000);
  });
});

describe('BillingManager.applyLateFees', () => {
  it('wraps the scalar count in a named field', async () => {
    const repo = {
      applyLateFees: vi.fn().mockResolvedValue(3),
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    const result = await manager.applyLateFees({});

    expect(result).toEqual({ lateFeeCount: 3 });
  });
});

describe('BillingManager.recordPayment', () => {
  it('re-reads the freshly recorded payment for the response', async () => {
    const recordPayment = vi.fn().mockResolvedValue('pay-1');
    const getPaymentById = vi.fn().mockResolvedValue({
      id: 'pay-1',
      billing_account_id: 'ba-1',
      paid_on: '2026-11-07',
      amount_cents: 75000,
      method: 'eft',
      reference: '',
      recorded_by: 'admin-1',
      created_at: new Date('2026-11-07T00:00:00Z'),
    });
    const repo = { recordPayment, getPaymentById } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    const dto = await manager.recordPayment('ba-1', { amountCents: 75000, method: 'eft' });

    expect(recordPayment).toHaveBeenCalledWith({
      billingAccountId: 'ba-1',
      amountCents: 75000,
      method: 'eft',
      reference: undefined,
      paidOn: undefined,
    });
    expect(dto.id).toBe('pay-1');
  });
});

describe('BillingManager.issueCreditNote', () => {
  it('404s when the invoice belongs to a different billing account', async () => {
    const repo = {
      getInvoiceById: vi.fn().mockResolvedValue({ ...INVOICE_ROW, billing_account_id: 'ba-OTHER' }),
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    await expect(
      manager.issueCreditNote(
        'ba-1',
        { invoiceId: 'inv-1', amountCents: 1000, reason: 'Waived' },
        { id: 'admin-1', roles: ['admin'], claims: {} },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates then allocates inside one UnitOfWork, with issuedBy taken from the actor never the body', async () => {
    const order: string[] = [];
    const uow = makeUow();
    const createCreditNote = vi.fn().mockImplementation((input: { issuedBy: string }) => {
      order.push('create');
      expect(input.issuedBy).toBe('admin-1');
      return Promise.resolve('cn-1');
    });
    const allocateCreditNote = vi.fn().mockImplementation(() => {
      order.push('allocate');
      return Promise.resolve();
    });
    const repo = {
      getInvoiceById: vi.fn().mockResolvedValue(INVOICE_ROW),
      createCreditNote,
      allocateCreditNote,
      getCreditNoteById: vi.fn().mockResolvedValue({
        id: 'cn-1',
        billing_account_id: 'ba-1',
        issued_on: '2026-11-07',
        amount_cents: 1000,
        reason: 'Waived',
        issued_by: 'admin-1',
      }),
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, uow);

    const dto = await manager.issueCreditNote(
      'ba-1',
      { invoiceId: 'inv-1', amountCents: 1000, reason: 'Waived' },
      { id: 'admin-1', roles: ['admin'], claims: {} },
    );

    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['create', 'allocate']);
    expect(allocateCreditNote).toHaveBeenCalledWith('cn-1', 'inv-1', 1000);
    expect(dto.id).toBe('cn-1');
  });
});

describe('BillingManager.getOutstanding', () => {
  it('maps every row, parsing its bigint/numeric aggregate columns', async () => {
    const repo = {
      getOutstanding: vi.fn().mockResolvedValue([
        {
          billing_account_id: 'ba-1',
          guardian_id: 'guardian-1',
          guardian_name: 'Jane Parent',
          open_invoices: '2',
          outstanding_cents: '150000',
          max_days_overdue: 10,
        },
      ]),
    } as unknown as BillingRepository;
    const manager = new BillingManager(repo, makeUow());

    const [dto] = await manager.getOutstanding();

    expect(dto).toEqual({
      billingAccountId: 'ba-1',
      guardianId: 'guardian-1',
      guardianName: 'Jane Parent',
      openInvoices: 2,
      outstandingCents: 150000,
      maxDaysOverdue: 10,
    });
  });
});
