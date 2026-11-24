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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  ActivateEnrolmentDto,
  ActivateEnrolmentResultDto,
} from './dto/activate-enrolment.dto.js';
import {
  AcceptEnrolmentResultDto,
  DeclineEnrolmentDto,
  EnrolmentProgressDto,
  QuoteDto,
  QuoteQueryDto,
  ReportCardFiledDto,
} from './dto/application.dto.js';
import { EnrolmentDto, ListEnrolmentsQueryDto } from './dto/enrolment.dto.js';
import { ReportCardUploadDto, SubmitEnrolmentDto } from './dto/submit-enrolment.dto.js';
import {
  EnrolmentSubjectDto,
  UpdateEnrolmentSubjectsDto,
} from './dto/update-enrolment-subjects.dto.js';
import { EnrolmentManager } from './enrolment.manager.js';

@ApiTags('enrolment')
@ApiBearerAuth()
@Controller('enrolments')
export class EnrolmentController {
  constructor(private readonly manager: EnrolmentManager) {}

  @Post()
  @Roles('parent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'The guardian-facing enrolment form — creates the learner, safeguarding records, consents and a pending enrolment in one go',
  })
  @ApiCreatedResponse({ type: EnrolmentDto })
  submit(
    @CurrentUser() actor: AuthUser,
    @Body() dto: SubmitEnrolmentDto,
  ): Promise<EnrolmentDto> {
    return this.manager.submit(actor, dto);
  }

  @Get('quote')
  @Roles('parent', 'admin')
  @ApiOperation({
    summary:
      'What acceptance on a date would cost: registration (if not yet paid) + pro-rata tuition (SPEC §5)',
  })
  @ApiOkResponse({ type: QuoteDto })
  quote(@Query() query: QuoteQueryDto): Promise<QuoteDto> {
    return this.manager.quote(query);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Where the application is (derived, SPEC §4.5)' })
  @ApiOkResponse({ type: EnrolmentProgressDto })
  progress(@Param('id', ParseUUIDPipe) id: string): Promise<EnrolmentProgressDto> {
    return this.manager.progress(id);
  }

  @Put(':id/report-card')
  @Roles('parent', 'admin')
  @ApiOperation({
    summary: 'Replace the report card (guardian while waiting for review; admin any time)',
  })
  @ApiOkResponse({ type: ReportCardFiledDto })
  replaceReportCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportCardUploadDto,
  ): Promise<ReportCardFiledDto> {
    return this.manager.replaceReportCard(id, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      "Get an enrolment (the learner's guardian, the assigned tutor, or admin)",
  })
  @ApiOkResponse({ type: EnrolmentDto })
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<EnrolmentDto> {
    return this.manager.getById(id);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Admin enrolment queue, filterable by status' })
  @ApiOkResponse({ type: EnrolmentDto, isArray: true })
  list(@Query() query: ListEnrolmentsQueryDto) {
    return this.manager.list(query);
  }

  @Post(':id/accept')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Accept: raises the pre-paid offer invoice (registration + pro-rata tuition) and notifies the parent. Refused without a finished aptitude test and a report card',
  })
  @ApiOkResponse({ type: AcceptEnrolmentResultDto })
  accept(@Param('id', ParseUUIDPipe) id: string): Promise<AcceptEnrolmentResultDto> {
    return this.manager.accept(id);
  }

  @Post(':id/activate')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Admin retry of activation: only an accepted application whose offer invoice is paid. Normally done by payment verification',
  })
  @ApiOkResponse({ type: ActivateEnrolmentResultDto })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivateEnrolmentDto,
  ): Promise<ActivateEnrolmentResultDto> {
    return this.manager.activate(id, dto);
  }

  @Post(':id/decline')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline an application waiting for review; a reason is required and the parent is told' })
  @ApiOkResponse({ type: EnrolmentDto })
  decline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeclineEnrolmentDto,
  ): Promise<EnrolmentDto> {
    return this.manager.decline(id, dto);
  }

  @Patch(':id/subjects')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Replace the subject selection (count must not exceed the package allowance)',
  })
  @ApiOkResponse({ type: EnrolmentSubjectDto, isArray: true })
  updateSubjects(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnrolmentSubjectsDto,
  ): Promise<EnrolmentSubjectDto[]> {
    return this.manager.updateSubjects(id, dto);
  }
}
