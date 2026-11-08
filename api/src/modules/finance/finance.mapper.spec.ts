import { FinanceMapper } from './finance.mapper.js';

describe('FinanceMapper.expenseCategoryToDto', () => {
  it('keeps a null budget_cents as undefined, not 0', () => {
    const dto = FinanceMapper.expenseCategoryToDto({ code: 'rent', name: 'Rent', budget_cents: null, sort_order: 1 });
    expect(dto.budgetCents).toBeUndefined();
  });

  it('passes through a real budget_cents unchanged (already a native integer, no string parse needed)', () => {
    const dto = FinanceMapper.expenseCategoryToDto({
      code: 'rent',
      name: 'Rent',
      budget_cents: 500000,
      sort_order: 1,
    });
    expect(dto.budgetCents).toBe(500000);
  });
});

describe('FinanceMapper.expenseToDto', () => {
  it('maps every field, keeping a null recorded_by as undefined', () => {
    const createdAt = new Date('2026-11-01T00:00:00Z');
    const dto = FinanceMapper.expenseToDto({
      id: 'e1',
      category_code: 'rent',
      incurred_on: '2026-11-01',
      amount_cents: 500000,
      description: '',
      recorded_by: null,
      created_at: createdAt,
    });
    expect(dto).toEqual({
      id: 'e1',
      categoryCode: 'rent',
      incurredOn: '2026-11-01',
      amountCents: 500000,
      description: '',
      recordedBy: undefined,
      createdAt,
    });
  });
});

describe('FinanceMapper — bigint/numeric KPI columns parsed to number, nulls preserved as undefined', () => {
  it('parses every non-null aggregate column on monthlyRevenueToDto', () => {
    const dto = FinanceMapper.monthlyRevenueToDto({
      month: '2026-11-01',
      invoiced_cents: '150000',
      collected_cents: '75000',
    });
    expect(dto).toEqual({ month: '2026-11-01', invoicedCents: 150000, collectedCents: 75000 });
  });

  it('keeps a genuinely null aggregate as undefined, never coercing it to 0', () => {
    const dto = FinanceMapper.revenuePerLearnerToDto({
      month: '2026-11-01',
      learners_billed: '0',
      invoiced_cents: '0',
      avg_cents_per_learner: null,
    });
    expect(dto.avgCentsPerLearner).toBeUndefined();
    expect(dto.learnersBilled).toBe(0);
  });

  it('parses break-even\'s mixed non-null/nullable columns correctly', () => {
    const dto = FinanceMapper.breakEvenToDto({
      month: '2026-11-01',
      expense_cents: '1700000',
      avg_cents_per_learner: '75000',
      learners_needed_to_break_even: '23',
      active_learners: '25',
    });
    expect(dto).toEqual({
      month: '2026-11-01',
      expenseCents: 1700000,
      avgCentsPerLearner: 75000,
      learnersNeededToBreakEven: 23,
      activeLearners: 25,
    });
  });

  it('breakEvenToDto leaves fields undefined when their source columns are null (no matching month row to join)', () => {
    const dto = FinanceMapper.breakEvenToDto({
      month: '2026-11-01',
      expense_cents: '1700000',
      avg_cents_per_learner: null,
      learners_needed_to_break_even: null,
      active_learners: null,
    });
    expect(dto.avgCentsPerLearner).toBeUndefined();
    expect(dto.learnersNeededToBreakEven).toBeUndefined();
    expect(dto.activeLearners).toBeUndefined();
  });
});
