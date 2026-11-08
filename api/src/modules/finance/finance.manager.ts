import { Injectable } from '@nestjs/common';
import { CacheService } from '../../common/cache/cache.service.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  CreateExpenseCategoryDto,
  ExpenseCategoryDto,
  ExpenseDto,
  RecordExpenseDto,
} from './dto/expense.dto.js';
import {
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
import { financeCacheKeys, FINANCE_KPI_CACHE_TTL_SECONDS } from './finance-cache-keys.js';
import { FinanceMapper } from './finance.mapper.js';
import { DateRange, FinanceRepository } from './finance.repository.js';

@Injectable()
export class FinanceManager {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly cache: CacheService,
  ) {}

  async listExpenseCategories(): Promise<ExpenseCategoryDto[]> {
    const rows = await this.repo.listExpenseCategories();
    return rows.map((row) => FinanceMapper.expenseCategoryToDto(row));
  }

  async createExpenseCategory(dto: CreateExpenseCategoryDto): Promise<ExpenseCategoryDto> {
    const row = await this.repo.createExpenseCategory(dto);
    return FinanceMapper.expenseCategoryToDto(row);
  }

  async listExpenses(query: { from?: string; to?: string; categoryCode?: string }): Promise<ExpenseDto[]> {
    const rows = await this.repo.listExpenses(query);
    return rows.map((row) => FinanceMapper.expenseToDto(row));
  }

  async recordExpense(actor: AuthUser, dto: RecordExpenseDto): Promise<ExpenseDto> {
    const row = await this.repo.recordExpense({
      categoryCode: dto.categoryCode,
      incurredOn: dto.incurredOn,
      amountCents: dto.amountCents,
      description: dto.description,
      recordedBy: actor.id,
    });
    return FinanceMapper.expenseToDto(row);
  }

  async getMonthlyRevenue(range: DateRange): Promise<MonthlyRevenueDto[]> {
    return this.cached(financeCacheKeys.monthlyRevenue(range), async () =>
      (await this.repo.getMonthlyRevenue(range)).map((row) => FinanceMapper.monthlyRevenueToDto(row)),
    );
  }

  async getMonthlyExpenses(range: DateRange): Promise<MonthlyExpensesDto[]> {
    return this.cached(financeCacheKeys.monthlyExpenses(range), async () =>
      (await this.repo.getMonthlyExpenses(range)).map((row) => FinanceMapper.monthlyExpensesToDto(row)),
    );
  }

  async getOperatingSurplus(range: DateRange): Promise<OperatingSurplusDto[]> {
    return this.cached(financeCacheKeys.operatingSurplus(range), async () =>
      (await this.repo.getOperatingSurplus(range)).map((row) => FinanceMapper.operatingSurplusToDto(row)),
    );
  }

  async getRevenuePerLearner(range: DateRange): Promise<RevenuePerLearnerDto[]> {
    return this.cached(financeCacheKeys.revenuePerLearner(range), async () =>
      (await this.repo.getRevenuePerLearner(range)).map((row) => FinanceMapper.revenuePerLearnerToDto(row)),
    );
  }

  async getAttendanceRate(range: DateRange): Promise<AttendanceRateDto[]> {
    return this.cached(financeCacheKeys.attendanceRate(range), async () =>
      (await this.repo.getAttendanceRate(range)).map((row) => FinanceMapper.attendanceRateToDto(row)),
    );
  }

  async getAssessmentImprovement(): Promise<AssessmentImprovementDto[]> {
    return this.cached(financeCacheKeys.assessmentImprovement, async () =>
      (await this.repo.getAssessmentImprovement()).map((row) => FinanceMapper.assessmentImprovementToDto(row)),
    );
  }

  async getLearnerCounts(range: DateRange): Promise<LearnerCountsDto[]> {
    return this.cached(financeCacheKeys.learnerCounts(range), async () =>
      (await this.repo.getLearnerCounts(range)).map((row) => FinanceMapper.learnerCountsToDto(row)),
    );
  }

  async getLearnerRetention(range: DateRange): Promise<LearnerRetentionDto[]> {
    return this.cached(financeCacheKeys.learnerRetention(range), async () =>
      (await this.repo.getLearnerRetention(range)).map((row) => FinanceMapper.learnerRetentionToDto(row)),
    );
  }

  async getEnquiryFunnel(range: DateRange): Promise<EnquiryFunnelDto[]> {
    return this.cached(financeCacheKeys.enquiryFunnel(range), async () =>
      (await this.repo.getEnquiryFunnel(range)).map((row) => FinanceMapper.enquiryFunnelToDto(row)),
    );
  }

  async getTutorSessionLoad(range: DateRange & { tutorId?: string }): Promise<TutorSessionLoadDto[]> {
    return this.cached(financeCacheKeys.tutorSessionLoad(range), async () =>
      (await this.repo.getTutorSessionLoad(range)).map((row) => FinanceMapper.tutorSessionLoadToDto(row)),
    );
  }

  async getBreakEven(range: DateRange): Promise<BreakEvenDto[]> {
    return this.cached(financeCacheKeys.breakEven(range), async () =>
      (await this.repo.getBreakEven(range)).map((row) => FinanceMapper.breakEvenToDto(row)),
    );
  }

  private async cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit) return hit;
    const value = await compute();
    await this.cache.set(key, value, FINANCE_KPI_CACHE_TTL_SECONDS);
    return value;
  }
}
