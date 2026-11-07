import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssessmentManager } from './assessment.manager';
import { AssessmentDto, RecordAssessmentDto } from './dto/assessment.dto';
import {
  CreateLearningPlanDto,
  LearningPlanDto,
  LearningPlanGoalDto,
  UpdateGoalStatusDto,
} from './dto/learning-plan.dto';

@ApiTags('assessment')
@ApiBearerAuth()
@Controller()
export class AssessmentController {
  constructor(private readonly manager: AssessmentManager) {}

  @Get('learners/:id/assessments')
  @ApiOperation({ summary: 'List a learner’s assessments (can-view-learner)' })
  @ApiOkResponse({ type: AssessmentDto, isArray: true })
  listAssessments(@Param('id', ParseUUIDPipe) id: string): Promise<AssessmentDto[]> {
    return this.manager.listAssessments(id);
  }

  @Post('learners/:id/assessments')
  @Roles('admin', 'tutor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record an assessment with its per-domain scores (teaching tutor, admin)' })
  @ApiCreatedResponse({ type: AssessmentDto })
  recordAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordAssessmentDto,
  ): Promise<AssessmentDto> {
    return this.manager.recordAssessment(id, dto);
  }

  @Get('learners/:id/learning-plans')
  @ApiOperation({ summary: 'List a learner’s learning plans (can-view-learner)' })
  @ApiOkResponse({ type: LearningPlanDto, isArray: true })
  listLearningPlans(@Param('id', ParseUUIDPipe) id: string): Promise<LearningPlanDto[]> {
    return this.manager.listLearningPlans(id);
  }

  @Post('learners/:id/learning-plans')
  @Roles('admin', 'tutor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a learning plan, superseding the learner’s current active plan (teaching tutor, admin)',
  })
  @ApiCreatedResponse({ type: LearningPlanDto })
  createLearningPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLearningPlanDto,
  ): Promise<LearningPlanDto> {
    return this.manager.createLearningPlan(id, dto);
  }

  @Patch('learning-plans/:id/goals/:goalId')
  @Roles('admin', 'tutor')
  @ApiOperation({ summary: 'Update a learning plan goal’s status (teaching tutor, admin)' })
  @ApiOkResponse({ type: LearningPlanGoalDto })
  updateGoalStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() dto: UpdateGoalStatusDto,
  ): Promise<LearningPlanGoalDto> {
    return this.manager.updateGoalStatus(id, goalId, dto);
  }
}
