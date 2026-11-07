import type { CacheService } from '../../common/cache/cache.service';
import { FinanceManager } from './finance.manager';
import type { FinanceRepository } from './finance.repository';

function makeCache() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: vi.fn(),
    store,
  };
}

describe('FinanceManager — KPI caching', () => {
  it('caches on a miss, keyed to the exact range, and skips the repository on a hit', async () => {
    const cache = makeCache();
    const getMonthlyRevenue = vi.fn().mockResolvedValue([
      { month: '2026-11-01', invoiced_cents: '100000', collected_cents: '90000' },
    ]);
    const repo = { getMonthlyRevenue } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, cache as unknown as CacheService);

    await manager.getMonthlyRevenue({ from: '2026-01-01', to: '2026-12-01' });
    await manager.getMonthlyRevenue({ from: '2026-01-01', to: '2026-12-01' });

    expect(getMonthlyRevenue).toHaveBeenCalledTimes(1);
    expect(cache.store.has('skolopals:finance:kpi:monthlyRevenue:2026-01-01:2026-12-01')).toBe(true);
  });

  it('treats two different ranges as two different cache entries', async () => {
    const cache = makeCache();
    const getMonthlyRevenue = vi.fn().mockResolvedValue([]);
    const repo = { getMonthlyRevenue } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, cache as unknown as CacheService);

    await manager.getMonthlyRevenue({ from: '2026-01-01' });
    await manager.getMonthlyRevenue({ from: '2026-02-01' });

    expect(getMonthlyRevenue).toHaveBeenCalledTimes(2);
  });

  it('assessmentImprovement has no range and uses a single, un-parameterised cache key', async () => {
    const cache = makeCache();
    const getAssessmentImprovement = vi.fn().mockResolvedValue([]);
    const repo = { getAssessmentImprovement } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, cache as unknown as CacheService);

    await manager.getAssessmentImprovement();

    expect(cache.store.has('skolopals:finance:kpi:assessmentImprovement')).toBe(true);
  });

  it('tutorSessionLoad keys the cache per tutorId as well as per range', async () => {
    const cache = makeCache();
    const getTutorSessionLoad = vi.fn().mockResolvedValue([]);
    const repo = { getTutorSessionLoad } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, cache as unknown as CacheService);

    await manager.getTutorSessionLoad({ tutorId: 't1' });
    await manager.getTutorSessionLoad({ tutorId: 't2' });

    expect(getTutorSessionLoad).toHaveBeenCalledTimes(2);
  });
});

describe('FinanceManager — expense categories/expenses (uncached, admin-only lists)', () => {
  it('listExpenseCategories maps every row', async () => {
    const listExpenseCategories = vi
      .fn()
      .mockResolvedValue([{ code: 'rent', name: 'Rent', budget_cents: 500000, sort_order: 1 }]);
    const repo = { listExpenseCategories } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const dtos = await manager.listExpenseCategories();

    expect(dtos).toEqual([{ code: 'rent', name: 'Rent', budgetCents: 500000, sortOrder: 1 }]);
  });

  it('createExpenseCategory maps the newly-created row', async () => {
    const createExpenseCategory = vi
      .fn()
      .mockResolvedValue({ code: 'rent', name: 'Rent', budget_cents: 500000, sort_order: 1 });
    const repo = { createExpenseCategory } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const dto = await manager.createExpenseCategory({ code: 'rent', name: 'Rent', sortOrder: 1 });

    expect(createExpenseCategory).toHaveBeenCalledWith({ code: 'rent', name: 'Rent', sortOrder: 1 });
    expect(dto.name).toBe('Rent');
  });

  it('listExpenses passes the query straight through and maps every row', async () => {
    const listExpenses = vi.fn().mockResolvedValue([
      {
        id: 'e1',
        category_code: 'rent',
        incurred_on: '2026-11-01',
        amount_cents: 500000,
        description: '',
        recorded_by: 'admin-1',
        created_at: new Date('2026-11-01T00:00:00Z'),
      },
    ]);
    const repo = { listExpenses } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const dtos = await manager.listExpenses({ categoryCode: 'rent' });

    expect(listExpenses).toHaveBeenCalledWith({ categoryCode: 'rent' });
    expect(dtos[0]?.amountCents).toBe(500000);
  });
});

describe('FinanceManager — every KPI method caches and maps its own view, parsing bigint/numeric columns', () => {
  it('getMonthlyExpenses', async () => {
    const getMonthlyExpenses = vi.fn().mockResolvedValue([{ month: '2026-11-01', expense_cents: '400000' }]);
    const repo = { getMonthlyExpenses } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const [dto] = await manager.getMonthlyExpenses({});

    expect(dto).toEqual({ month: '2026-11-01', expenseCents: 400000 });
  });

  it('getOperatingSurplus', async () => {
    const getOperatingSurplus = vi.fn().mockResolvedValue([
      {
        month: '2026-11-01',
        invoiced_cents: '100000',
        collected_cents: '90000',
        expense_cents: '40000',
        surplus_cents: '50000',
      },
    ]);
    const repo = { getOperatingSurplus } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const [dto] = await manager.getOperatingSurplus({});

    expect(dto).toEqual({
      month: '2026-11-01',
      invoicedCents: 100000,
      collectedCents: 90000,
      expenseCents: 40000,
      surplusCents: 50000,
    });
  });

  it('getRevenuePerLearner keeps a null avg_cents_per_learner as undefined', async () => {
    const getRevenuePerLearner = vi.fn().mockResolvedValue([
      { month: '2026-11-01', learners_billed: '0', invoiced_cents: '0', avg_cents_per_learner: null },
    ]);
    const repo = { getRevenuePerLearner } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const [dto] = await manager.getRevenuePerLearner({});

    expect(dto?.avgCentsPerLearner).toBeUndefined();
    expect(dto?.learnersBilled).toBe(0);
  });

  it('getAttendanceRate', async () => {
    const getAttendanceRate = vi.fn().mockResolvedValue([
      { month: '2026-11-01', sessions_recorded: '20', attended: '18', attendance_rate_pct: '90.0' },
    ]);
    const repo = { getAttendanceRate } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const [dto] = await manager.getAttendanceRate({});

    expect(dto).toEqual({ month: '2026-11-01', sessionsRecorded: 20, attended: 18, attendanceRatePct: 90 });
  });

  it('getLearnerCounts', async () => {
    const getLearnerCounts = vi.fn().mockResolvedValue([
      { month: '2026-11-01', active_learners: '10', new_learners: '2', departed_learners: '1' },
    ]);
    const repo = { getLearnerCounts } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const [dto] = await manager.getLearnerCounts({});

    expect(dto).toEqual({ month: '2026-11-01', activeLearners: 10, newLearners: 2, departedLearners: 1 });
  });

  it('getLearnerRetention', async () => {
    const getLearnerRetention = vi.fn().mockResolvedValue([
      {
        month: '2026-11-01',
        active_learners: '10',
        new_learners: '2',
        departed_learners: '1',
        retention_pct: '90.9',
      },
    ]);
    const repo = { getLearnerRetention } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const [dto] = await manager.getLearnerRetention({});

    expect(dto).toEqual({
      month: '2026-11-01',
      activeLearners: 10,
      newLearners: 2,
      departedLearners: 1,
      retentionPct: 90.9,
    });
  });

  it('getEnquiryFunnel', async () => {
    const getEnquiryFunnel = vi.fn().mockResolvedValue([
      { month: '2026-11-01', source: 'website', enquiries: '10', converted: '3', conversion_pct: '30.0' },
    ]);
    const repo = { getEnquiryFunnel } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const [dto] = await manager.getEnquiryFunnel({});

    expect(dto).toEqual({
      month: '2026-11-01',
      source: 'website',
      enquiries: 10,
      converted: 3,
      conversionPct: 30,
    });
  });

  it('getTutorSessionLoad', async () => {
    const getTutorSessionLoad = vi.fn().mockResolvedValue([
      { tutor_id: 't1', month: '2026-11-01', sessions: '12', hours: '18.00' },
    ]);
    const repo = { getTutorSessionLoad } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const [dto] = await manager.getTutorSessionLoad({});

    expect(dto).toEqual({ tutorId: 't1', month: '2026-11-01', sessions: 12, hours: 18 });
  });

  it('getBreakEven', async () => {
    const getBreakEven = vi.fn().mockResolvedValue([
      {
        month: '2026-11-01',
        expense_cents: '400000',
        avg_cents_per_learner: '75000',
        learners_needed_to_break_even: '6',
        active_learners: '25',
      },
    ]);
    const repo = { getBreakEven } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    const [dto] = await manager.getBreakEven({});

    expect(dto).toEqual({
      month: '2026-11-01',
      expenseCents: 400000,
      avgCentsPerLearner: 75000,
      learnersNeededToBreakEven: 6,
      activeLearners: 25,
    });
  });
});

describe('FinanceManager.recordExpense', () => {
  it('passes the actor as recordedBy, never a client-supplied value', async () => {
    const recordExpense = vi.fn().mockResolvedValue({
      id: 'e1',
      category_code: 'rent',
      incurred_on: '2026-11-01',
      amount_cents: 500000,
      description: '',
      recorded_by: 'admin-1',
      created_at: new Date(),
    });
    const repo = { recordExpense } as unknown as FinanceRepository;
    const manager = new FinanceManager(repo, makeCache() as unknown as CacheService);

    await manager.recordExpense({ id: 'admin-1', roles: ['admin'], claims: {} }, {
      categoryCode: 'rent',
      incurredOn: '2026-11-01',
      amountCents: 500000,
    });

    expect(recordExpense).toHaveBeenCalledWith({
      categoryCode: 'rent',
      incurredOn: '2026-11-01',
      amountCents: 500000,
      description: undefined,
      recordedBy: 'admin-1',
    });
  });
});
