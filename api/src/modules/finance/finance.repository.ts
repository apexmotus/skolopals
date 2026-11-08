import { Injectable } from '@nestjs/common';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { ExpenseCategoryRow, ExpenseRow } from './rows/expense.row.js';
import type {
  AssessmentImprovementRow,
  AttendanceRateRow,
  BreakEvenRow,
  EnquiryFunnelRow,
  LearnerCountsRow,
  LearnerRetentionRow,
  MonthlyExpensesRow,
  MonthlyRevenueRow,
  OperatingSurplusRow,
  RevenuePerLearnerRow,
  TutorSessionLoadRow,
} from './rows/kpi.row.js';

export interface DateRange {
  from?: string;
  to?: string;
}

/**
 * Every KPI method below is `select * from <existing view> where ($1::date
 * is null or month >= $1) and ($2::date is null or month <= $2) order by
 * month` — the views (`db/migrations/20261020000013_finance_kpis.sql`,
 * `...009_programmes.sql`) already do every bit of derivation (including
 * the `generate_series` monthly spine behind `v_learner_counts` and the
 * `FILTER` aggregates throughout) — Phase 0 §5 voids any "recreate the
 * views" work, so there is nothing here beyond the thin read wrapper the
 * plan's own framing promises. `v_assessment_improvement` has no `month`
 * column (a per-learner-per-domain snapshot, not a time series) and so is
 * the one KPI read with no range filter at all, matching the endpoint
 * table's own `getAssessmentImprovement()` (no `(range)` suffix, unlike
 * every other KPI method).
 */
@Injectable()
export class FinanceRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  listExpenseCategories(): Promise<ExpenseCategoryRow[]> {
    return this.sp.selectMany<ExpenseCategoryRow>(
      'select code, name, budget_cents, sort_order from public.expense_categories order by sort_order',
    );
  }

  async createExpenseCategory(input: {
    code: string;
    name: string;
    budgetCents?: number;
    sortOrder: number;
  }): Promise<ExpenseCategoryRow> {
    const result = await this.sp.executeRaw<ExpenseCategoryRow>(
      `insert into public.expense_categories (code, name, budget_cents, sort_order)
       values ($1, $2, $3, $4)
       returning code, name, budget_cents, sort_order`,
      [input.code, input.name, input.budgetCents ?? null, input.sortOrder],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  listExpenses(range: DateRange & { categoryCode?: string }): Promise<ExpenseRow[]> {
    const values: unknown[] = [range.from ?? null, range.to ?? null, range.categoryCode ?? null];
    return this.sp.selectMany<ExpenseRow>(
      `select id, category_code, incurred_on, amount_cents, description, recorded_by, created_at
       from public.expenses
       where ($1::date is null or incurred_on >= $1)
         and ($2::date is null or incurred_on <= $2)
         and ($3::text is null or category_code = $3)
       order by incurred_on desc`,
      values,
    );
  }

  async recordExpense(input: {
    categoryCode: string;
    incurredOn: string;
    amountCents: number;
    description?: string;
    recordedBy: string;
  }): Promise<ExpenseRow> {
    const result = await this.sp.executeRaw<ExpenseRow>(
      `insert into public.expenses (category_code, incurred_on, amount_cents, description, recorded_by)
       values ($1, $2, $3, coalesce($4, ''), $5)
       returning id, category_code, incurred_on, amount_cents, description, recorded_by, created_at`,
      [input.categoryCode, input.incurredOn, input.amountCents, input.description ?? null, input.recordedBy],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  getMonthlyRevenue(range: DateRange): Promise<MonthlyRevenueRow[]> {
    return this.selectRange<MonthlyRevenueRow>('v_monthly_revenue', 'month, invoiced_cents, collected_cents', range);
  }

  getMonthlyExpenses(range: DateRange): Promise<MonthlyExpensesRow[]> {
    return this.selectRange<MonthlyExpensesRow>('v_monthly_expenses', 'month, expense_cents', range);
  }

  getOperatingSurplus(range: DateRange): Promise<OperatingSurplusRow[]> {
    return this.selectRange<OperatingSurplusRow>(
      'v_operating_surplus',
      'month, invoiced_cents, collected_cents, expense_cents, surplus_cents',
      range,
    );
  }

  getRevenuePerLearner(range: DateRange): Promise<RevenuePerLearnerRow[]> {
    return this.selectRange<RevenuePerLearnerRow>(
      'v_revenue_per_learner',
      'month, learners_billed, invoiced_cents, avg_cents_per_learner',
      range,
    );
  }

  getAttendanceRate(range: DateRange): Promise<AttendanceRateRow[]> {
    return this.selectRange<AttendanceRateRow>(
      'v_attendance_rate',
      'month, sessions_recorded, attended, attendance_rate_pct',
      range,
    );
  }

  getAssessmentImprovement(): Promise<AssessmentImprovementRow[]> {
    return this.sp.selectMany<AssessmentImprovementRow>(
      'select learner_id, domain_code, initial_pct, latest_pct, change_pct from public.v_assessment_improvement order by learner_id, domain_code',
    );
  }

  getLearnerCounts(range: DateRange): Promise<LearnerCountsRow[]> {
    return this.selectRange<LearnerCountsRow>(
      'v_learner_counts',
      'month, active_learners, new_learners, departed_learners',
      range,
    );
  }

  getLearnerRetention(range: DateRange): Promise<LearnerRetentionRow[]> {
    return this.selectRange<LearnerRetentionRow>(
      'v_learner_retention',
      'month, active_learners, new_learners, departed_learners, retention_pct',
      range,
    );
  }

  getEnquiryFunnel(range: DateRange): Promise<EnquiryFunnelRow[]> {
    return this.selectRange<EnquiryFunnelRow>(
      'v_enquiry_funnel',
      'month, source, enquiries, converted, conversion_pct',
      range,
      'month, source',
    );
  }

  getTutorSessionLoad(range: DateRange & { tutorId?: string }): Promise<TutorSessionLoadRow[]> {
    const values: unknown[] = [range.from ?? null, range.to ?? null, range.tutorId ?? null];
    return this.sp.selectMany<TutorSessionLoadRow>(
      `select tutor_id, month, sessions, hours from public.v_tutor_session_load
       where ($1::date is null or month >= $1)
         and ($2::date is null or month <= $2)
         and ($3::uuid is null or tutor_id = $3)
       order by month, tutor_id`,
      values,
    );
  }

  getBreakEven(range: DateRange): Promise<BreakEvenRow[]> {
    return this.selectRange<BreakEvenRow>(
      'v_break_even',
      'month, expense_cents, avg_cents_per_learner, learners_needed_to_break_even, active_learners',
      range,
    );
  }

  /** Every monthly KPI view shares this exact shape: filter `month` by an optional `[from, to]` range, ordered by it. */
  private selectRange<T extends object>(
    view: string,
    columns: string,
    range: DateRange,
    orderBy = 'month',
  ): Promise<T[]> {
    return this.sp.selectMany<T>(
      `select ${columns} from public.${view}
       where ($1::date is null or month >= $1)
         and ($2::date is null or month <= $2)
       order by ${orderBy}`,
      [range.from ?? null, range.to ?? null],
    );
  }
}
