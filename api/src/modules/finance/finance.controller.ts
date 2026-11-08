import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  CreateExpenseCategoryDto,
  ExpenseCategoryDto,
  ExpenseDto,
  ListExpensesQueryDto,
  RecordExpenseDto,
} from './dto/expense.dto.js';
import { KpiRangeQueryDto, TutorSessionLoadQueryDto } from './dto/kpi-range.dto.js';
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
import { FinanceManager } from './finance.manager.js';

/** Every route here is admin-only — this module owns no write path except the two expense-recording endpoints, and never writes to another module's tables. */
@ApiTags('finance')
@ApiBearerAuth()
@Roles('admin')
@Controller('finance')
export class FinanceController {
  constructor(private readonly manager: FinanceManager) {}

  @Get('expense-categories')
  @ApiOperation({ summary: 'List expense categories' })
  @ApiOkResponse({ type: ExpenseCategoryDto, isArray: true })
  listExpenseCategories(): Promise<ExpenseCategoryDto[]> {
    return this.manager.listExpenseCategories();
  }

  @Post('expense-categories')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an expense category' })
  @ApiCreatedResponse({ type: ExpenseCategoryDto })
  createExpenseCategory(@Body() dto: CreateExpenseCategoryDto): Promise<ExpenseCategoryDto> {
    return this.manager.createExpenseCategory(dto);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'List recorded expenses' })
  @ApiOkResponse({ type: ExpenseDto, isArray: true })
  listExpenses(@Query() query: ListExpensesQueryDto): Promise<ExpenseDto[]> {
    return this.manager.listExpenses(query);
  }

  @Post('expenses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record an expense' })
  @ApiCreatedResponse({ type: ExpenseDto })
  recordExpense(@CurrentUser() actor: AuthUser, @Body() dto: RecordExpenseDto): Promise<ExpenseDto> {
    return this.manager.recordExpense(actor, dto);
  }

  @Get('kpis/monthly-revenue')
  @ApiOperation({ summary: 'Monthly invoiced vs. collected revenue' })
  @ApiOkResponse({ type: MonthlyRevenueDto, isArray: true })
  getMonthlyRevenue(@Query() query: KpiRangeQueryDto): Promise<MonthlyRevenueDto[]> {
    return this.manager.getMonthlyRevenue(query);
  }

  @Get('kpis/monthly-expenses')
  @ApiOperation({ summary: 'Monthly recorded expenses' })
  @ApiOkResponse({ type: MonthlyExpensesDto, isArray: true })
  getMonthlyExpenses(@Query() query: KpiRangeQueryDto): Promise<MonthlyExpensesDto[]> {
    return this.manager.getMonthlyExpenses(query);
  }

  @Get('kpis/operating-surplus')
  @ApiOperation({ summary: 'Monthly operating surplus, on a cash-collected basis' })
  @ApiOkResponse({ type: OperatingSurplusDto, isArray: true })
  getOperatingSurplus(@Query() query: KpiRangeQueryDto): Promise<OperatingSurplusDto[]> {
    return this.manager.getOperatingSurplus(query);
  }

  @Get('kpis/revenue-per-learner')
  @ApiOperation({ summary: 'Monthly revenue per billed learner' })
  @ApiOkResponse({ type: RevenuePerLearnerDto, isArray: true })
  getRevenuePerLearner(@Query() query: KpiRangeQueryDto): Promise<RevenuePerLearnerDto[]> {
    return this.manager.getRevenuePerLearner(query);
  }

  @Get('kpis/attendance-rate')
  @ApiOperation({ summary: 'Monthly attendance rate, across class and programme sessions' })
  @ApiOkResponse({ type: AttendanceRateDto, isArray: true })
  getAttendanceRate(@Query() query: KpiRangeQueryDto): Promise<AttendanceRateDto[]> {
    return this.manager.getAttendanceRate(query);
  }

  @Get('kpis/assessment-improvement')
  @ApiOperation({ summary: 'Latest assessment score vs. the initial assessment, per learner per domain' })
  @ApiOkResponse({ type: AssessmentImprovementDto, isArray: true })
  getAssessmentImprovement(): Promise<AssessmentImprovementDto[]> {
    return this.manager.getAssessmentImprovement();
  }

  @Get('kpis/learner-counts')
  @ApiOperation({ summary: 'Monthly active/new/departed learner counts' })
  @ApiOkResponse({ type: LearnerCountsDto, isArray: true })
  getLearnerCounts(@Query() query: KpiRangeQueryDto): Promise<LearnerCountsDto[]> {
    return this.manager.getLearnerCounts(query);
  }

  @Get('kpis/learner-retention')
  @ApiOperation({ summary: 'Monthly learner retention rate' })
  @ApiOkResponse({ type: LearnerRetentionDto, isArray: true })
  getLearnerRetention(@Query() query: KpiRangeQueryDto): Promise<LearnerRetentionDto[]> {
    return this.manager.getLearnerRetention(query);
  }

  @Get('kpis/enquiry-funnel')
  @ApiOperation({ summary: 'Monthly enquiry volume and conversion rate, by source' })
  @ApiOkResponse({ type: EnquiryFunnelDto, isArray: true })
  getEnquiryFunnel(@Query() query: KpiRangeQueryDto): Promise<EnquiryFunnelDto[]> {
    return this.manager.getEnquiryFunnel(query);
  }

  @Get('kpis/tutor-session-load')
  @ApiOperation({ summary: 'Monthly sessions and hours taught, per tutor' })
  @ApiOkResponse({ type: TutorSessionLoadDto, isArray: true })
  getTutorSessionLoad(@Query() query: TutorSessionLoadQueryDto): Promise<TutorSessionLoadDto[]> {
    return this.manager.getTutorSessionLoad(query);
  }

  @Get('kpis/break-even')
  @ApiOperation({ summary: 'Monthly break-even learner count' })
  @ApiOkResponse({ type: BreakEvenDto, isArray: true })
  getBreakEven(@Query() query: KpiRangeQueryDto): Promise<BreakEvenDto[]> {
    return this.manager.getBreakEven(query);
  }
}
