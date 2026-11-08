import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { FinanceRepository } from './finance.repository.js';

function makeSp(overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {}): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    executeRaw: vi.fn().mockResolvedValue({ rows: [{ id: 'e1' }], rowCount: 1 }),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('FinanceRepository — monthly KPI views share one range-filter shape', () => {
  it('getMonthlyRevenue filters month by an optional [from, to], both null when omitted', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));

    await repo.getMonthlyRevenue({});

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('from public.v_monthly_revenue');
    expect(sql).toContain('$1::date is null or month >= $1');
    expect(sql).toContain('$2::date is null or month <= $2');
    expect(values).toEqual([null, null]);
  });

  it('getEnquiryFunnel orders by month then source, the view\'s two-dimensional key', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));

    await repo.getEnquiryFunnel({ from: '2026-01-01' });

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('order by month, source');
    expect(values).toEqual(['2026-01-01', null]);
  });
});

describe('FinanceRepository.getAssessmentImprovement', () => {
  it('has no range parameters at all — the view has no month column', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));

    await repo.getAssessmentImprovement();

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[] | undefined];
    expect(sql).toContain('from public.v_assessment_improvement');
    expect(values ?? []).toEqual([]);
  });
});

describe('FinanceRepository.getTutorSessionLoad', () => {
  it('adds an optional tutor_id filter on top of the standard range filter', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));

    await repo.getTutorSessionLoad({ tutorId: 't1' });

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('$3::uuid is null or tutor_id = $3');
    expect(values).toEqual([null, null, 't1']);
  });
});

describe('FinanceRepository — the rest of the range-filtered KPI views, each confirming its own view name/columns', () => {
  it('getMonthlyExpenses', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));
    await repo.getMonthlyExpenses({});
    expect(selectMany.mock.calls[0]?.[0]).toContain('from public.v_monthly_expenses');
  });

  it('getOperatingSurplus', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));
    await repo.getOperatingSurplus({});
    expect(selectMany.mock.calls[0]?.[0]).toContain('from public.v_operating_surplus');
  });

  it('getRevenuePerLearner', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));
    await repo.getRevenuePerLearner({});
    expect(selectMany.mock.calls[0]?.[0]).toContain('from public.v_revenue_per_learner');
  });

  it('getAttendanceRate', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));
    await repo.getAttendanceRate({});
    expect(selectMany.mock.calls[0]?.[0]).toContain('from public.v_attendance_rate');
  });

  it('getLearnerCounts', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));
    await repo.getLearnerCounts({});
    expect(selectMany.mock.calls[0]?.[0]).toContain('from public.v_learner_counts');
  });

  it('getLearnerRetention', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));
    await repo.getLearnerRetention({});
    expect(selectMany.mock.calls[0]?.[0]).toContain('from public.v_learner_retention');
  });

  it('getBreakEven', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));
    await repo.getBreakEven({});
    expect(selectMany.mock.calls[0]?.[0]).toContain('from public.v_break_even');
  });
});

describe('FinanceRepository.listExpenseCategories', () => {
  it('reads expense_categories ordered by sort_order', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));
    await repo.listExpenseCategories();
    expect(selectMany.mock.calls[0]?.[0]).toContain('from public.expense_categories');
  });
});

describe('FinanceRepository.createExpenseCategory', () => {
  it('inserts the four fields and returns the new row', async () => {
    const executeRaw = vi.fn().mockResolvedValue({
      rows: [{ code: 'rent', name: 'Rent', budget_cents: 500000, sort_order: 1 }],
      rowCount: 1,
    });
    const repo = new FinanceRepository(makeSp({ executeRaw }));

    const row = await repo.createExpenseCategory({ code: 'rent', name: 'Rent', budgetCents: 500000, sortOrder: 1 });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert into public.expense_categories');
    expect(values).toEqual(['rent', 'Rent', 500000, 1]);
    expect(row.code).toBe('rent');
  });

  it('throws if the insert unexpectedly returns no row', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new FinanceRepository(makeSp({ executeRaw }));

    await expect(repo.createExpenseCategory({ code: 'rent', name: 'Rent', sortOrder: 1 })).rejects.toThrow(
      'INSERT ... RETURNING unexpectedly returned no row',
    );
  });
});

describe('FinanceRepository.recordExpense', () => {
  it('inserts with the description defaulted to empty when omitted', async () => {
    const executeRaw = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 'e1',
          category_code: 'rent',
          incurred_on: '2026-11-01',
          amount_cents: 500000,
          description: '',
          recorded_by: 'admin-1',
          created_at: new Date(),
        },
      ],
      rowCount: 1,
    });
    const repo = new FinanceRepository(makeSp({ executeRaw }));

    await repo.recordExpense({
      categoryCode: 'rent',
      incurredOn: '2026-11-01',
      amountCents: 500000,
      recordedBy: 'admin-1',
    });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert into public.expenses');
    expect(values).toEqual(['rent', '2026-11-01', 500000, null, 'admin-1']);
  });
});

describe('FinanceRepository.listExpenses', () => {
  it('filters by date range and category, independently optional', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new FinanceRepository(makeSp({ selectMany }));

    await repo.listExpenses({ categoryCode: 'rent' });

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('category_code = $3');
    expect(values).toEqual([null, null, 'rent']);
  });
});
