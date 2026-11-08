import type { ExpenseCategoryDto, ExpenseDto } from './dto/expense.dto.js';
import type {
  AssessmentImprovementDto,
  AttendanceRateDto,
  BreakEvenDto,
  EnquiryFunnelDto,
  LearnerCountsDto,
  LearnerRetentionDto,
  MonthlyExpensesDto,
  MonthlyRevenueDto,
  OperatingSurplusDto,
  RevenuePerLearnerDto,
  TutorSessionLoadDto,
} from './dto/kpi.dto.js';
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

/** `Number(null)` is `0`, never used here: every nullable source field is explicitly guarded with `?? null` first, so a genuinely absent figure stays `undefined` on the DTO rather than becoming a misleading `0`. */
function toNumber(value: string): number;
function toNumber(value: string | null): number | undefined;
function toNumber(value: string | null): number | undefined {
  return value === null ? undefined : Number(value);
}

export class FinanceMapper {
  static expenseCategoryToDto(row: ExpenseCategoryRow): ExpenseCategoryDto {
    return {
      code: row.code,
      name: row.name,
      budgetCents: row.budget_cents ?? undefined,
      sortOrder: row.sort_order,
    };
  }

  static expenseToDto(row: ExpenseRow): ExpenseDto {
    return {
      id: row.id,
      categoryCode: row.category_code,
      incurredOn: row.incurred_on,
      amountCents: row.amount_cents,
      description: row.description,
      recordedBy: row.recorded_by ?? undefined,
      createdAt: row.created_at,
    };
  }

  static monthlyRevenueToDto(row: MonthlyRevenueRow): MonthlyRevenueDto {
    return {
      month: row.month,
      invoicedCents: toNumber(row.invoiced_cents),
      collectedCents: toNumber(row.collected_cents),
    };
  }

  static monthlyExpensesToDto(row: MonthlyExpensesRow): MonthlyExpensesDto {
    return { month: row.month, expenseCents: toNumber(row.expense_cents) };
  }

  static operatingSurplusToDto(row: OperatingSurplusRow): OperatingSurplusDto {
    return {
      month: row.month,
      invoicedCents: toNumber(row.invoiced_cents),
      collectedCents: toNumber(row.collected_cents),
      expenseCents: toNumber(row.expense_cents),
      surplusCents: toNumber(row.surplus_cents),
    };
  }

  static revenuePerLearnerToDto(row: RevenuePerLearnerRow): RevenuePerLearnerDto {
    return {
      month: row.month,
      learnersBilled: toNumber(row.learners_billed),
      invoicedCents: toNumber(row.invoiced_cents),
      avgCentsPerLearner: toNumber(row.avg_cents_per_learner),
    };
  }

  static attendanceRateToDto(row: AttendanceRateRow): AttendanceRateDto {
    return {
      month: row.month,
      sessionsRecorded: toNumber(row.sessions_recorded),
      attended: toNumber(row.attended),
      attendanceRatePct: toNumber(row.attendance_rate_pct),
    };
  }

  static assessmentImprovementToDto(row: AssessmentImprovementRow): AssessmentImprovementDto {
    return {
      learnerId: row.learner_id,
      domainCode: row.domain_code,
      initialPct: toNumber(row.initial_pct),
      latestPct: toNumber(row.latest_pct),
      changePct: toNumber(row.change_pct),
    };
  }

  static learnerCountsToDto(row: LearnerCountsRow): LearnerCountsDto {
    return {
      month: row.month,
      activeLearners: toNumber(row.active_learners),
      newLearners: toNumber(row.new_learners),
      departedLearners: toNumber(row.departed_learners),
    };
  }

  static learnerRetentionToDto(row: LearnerRetentionRow): LearnerRetentionDto {
    return {
      month: row.month,
      activeLearners: toNumber(row.active_learners),
      newLearners: toNumber(row.new_learners),
      departedLearners: toNumber(row.departed_learners),
      retentionPct: toNumber(row.retention_pct),
    };
  }

  static enquiryFunnelToDto(row: EnquiryFunnelRow): EnquiryFunnelDto {
    return {
      month: row.month,
      source: row.source,
      enquiries: toNumber(row.enquiries),
      converted: toNumber(row.converted),
      conversionPct: toNumber(row.conversion_pct),
    };
  }

  static tutorSessionLoadToDto(row: TutorSessionLoadRow): TutorSessionLoadDto {
    return {
      tutorId: row.tutor_id,
      month: row.month,
      sessions: toNumber(row.sessions),
      hours: toNumber(row.hours),
    };
  }

  static breakEvenToDto(row: BreakEvenRow): BreakEvenDto {
    return {
      month: row.month,
      expenseCents: toNumber(row.expense_cents),
      avgCentsPerLearner: toNumber(row.avg_cents_per_learner),
      learnersNeededToBreakEven: toNumber(row.learners_needed_to_break_even),
      activeLearners: toNumber(row.active_learners),
    };
  }
}
