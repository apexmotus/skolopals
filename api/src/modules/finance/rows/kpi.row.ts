/**
 * Every KPI view's aggregate columns (`numeric`/`bigint`, confirmed one by
 * one via `pg_attribute` against the real schema — none has a custom type
 * parser, unlike `date`) arrive as strings; every one is parsed to `number`
 * in `FinanceMapper`. `month`/`session_date`/`incurred_on`-style `date`
 * columns stay `string` (the existing global `date` parser already
 * normalizes those).
 */
export interface MonthlyRevenueRow {
  month: string;
  invoiced_cents: string;
  collected_cents: string;
}

export interface MonthlyExpensesRow {
  month: string;
  expense_cents: string;
}

export interface OperatingSurplusRow {
  month: string;
  invoiced_cents: string;
  collected_cents: string;
  expense_cents: string;
  surplus_cents: string;
}

export interface RevenuePerLearnerRow {
  month: string;
  learners_billed: string;
  invoiced_cents: string;
  avg_cents_per_learner: string | null;
}

export interface AttendanceRateRow {
  month: string;
  sessions_recorded: string;
  attended: string;
  attendance_rate_pct: string | null;
}

export interface AssessmentImprovementRow {
  learner_id: string;
  domain_code: string;
  initial_pct: string | null;
  latest_pct: string | null;
  change_pct: string | null;
}

export interface LearnerCountsRow {
  month: string;
  active_learners: string;
  new_learners: string;
  departed_learners: string;
}

export interface LearnerRetentionRow {
  month: string;
  active_learners: string;
  new_learners: string;
  departed_learners: string;
  retention_pct: string | null;
}

export interface EnquiryFunnelRow {
  month: string;
  source: string;
  enquiries: string;
  converted: string;
  conversion_pct: string | null;
}

export interface TutorSessionLoadRow {
  tutor_id: string;
  month: string;
  sessions: string;
  hours: string;
}

export interface BreakEvenRow {
  month: string;
  expense_cents: string;
  avg_cents_per_learner: string | null;
  learners_needed_to_break_even: string | null;
  active_learners: string | null;
}
