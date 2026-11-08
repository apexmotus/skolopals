import type { DateRange } from './finance.repository.js';

/**
 * `03-endpoints-and-business-rules.md` §finance: every KPI endpoint, 5-15
 * minute TTL. Deliberately time-based only, never invalidated on a write —
 * the writes live in other modules (`billing`, `attendance`, `enquiries`,
 * ...) and cross-module invalidation on every one of their writes would
 * cost more than the staleness a dashboard figure can tolerate. A stated
 * choice, not an oversight; do not "fix" this by wiring up invalidation
 * later without re-reading this rule.
 *
 * Only the 11 KPI reads (`v_*` wrappers) are cached. `expense_categories`/
 * `expenses` themselves are plain admin lists, not KPIs, and are outside
 * this rule's stated scope — left uncached, same as every other plain
 * admin-only list elsewhere in this codebase that has no caching rule of
 * its own.
 */
export const FINANCE_KPI_CACHE_TTL_SECONDS = 600;

function rangeKey(range: DateRange): string {
  return `${range.from ?? '-'}:${range.to ?? '-'}`;
}

export const financeCacheKeys = {
  monthlyRevenue: (range: DateRange) => `skolopals:finance:kpi:monthlyRevenue:${rangeKey(range)}`,
  monthlyExpenses: (range: DateRange) => `skolopals:finance:kpi:monthlyExpenses:${rangeKey(range)}`,
  operatingSurplus: (range: DateRange) => `skolopals:finance:kpi:operatingSurplus:${rangeKey(range)}`,
  revenuePerLearner: (range: DateRange) => `skolopals:finance:kpi:revenuePerLearner:${rangeKey(range)}`,
  attendanceRate: (range: DateRange) => `skolopals:finance:kpi:attendanceRate:${rangeKey(range)}`,
  assessmentImprovement: 'skolopals:finance:kpi:assessmentImprovement',
  learnerCounts: (range: DateRange) => `skolopals:finance:kpi:learnerCounts:${rangeKey(range)}`,
  learnerRetention: (range: DateRange) => `skolopals:finance:kpi:learnerRetention:${rangeKey(range)}`,
  enquiryFunnel: (range: DateRange) => `skolopals:finance:kpi:enquiryFunnel:${rangeKey(range)}`,
  tutorSessionLoad: (range: DateRange & { tutorId?: string }) =>
    `skolopals:finance:kpi:tutorSessionLoad:${rangeKey(range)}:${range.tutorId ?? '-'}`,
  breakEven: (range: DateRange) => `skolopals:finance:kpi:breakEven:${rangeKey(range)}`,
};
