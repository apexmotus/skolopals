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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Throttle } from '../../common/decorators/throttle.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  ApproveApplicationResultDto,
  ListApplicationsQueryDto,
  PoliceClearanceUploadDto,
  PurgeResultDto,
  RecruitmentRoundDto,
  RecruitmentSettingsDto,
  RecruitmentStatusDto,
  RequestPoliceClearanceDto,
  RetentionDueDto,
  SetApplicationStatusDto,
  SubmitTutorApplicationDto,
  SubmittedApplicationDto,
  TutorApplicationDetailDto,
  TutorApplicationSummaryDto,
} from './dto/tutor-application.dto.js';
import { type OwnApplication, TutorApplicationsManager } from './tutor-applications.manager.js';

/** SPEC-2026-11-tutor-applications.md §6. */
@ApiTags('tutor-applications')
@ApiBearerAuth()
@Controller()
export class TutorApplicationsController {
  constructor(private readonly manager: TutorApplicationsManager) {}

  // Recruitment ------------------------------------------------------------------

  @Get('tutor-applications/recruitment')
  @Public()
  @ApiOperation({ summary: 'Whether tutor applications are open, for the landing page and /teach (public)' })
  @ApiOkResponse({ type: RecruitmentStatusDto })
  status(): Promise<RecruitmentStatusDto> {
    return this.manager.status();
  }

  @Get('tutor-applications/recruitment/rounds')
  @Roles('admin')
  @ApiOperation({ summary: 'Recent recruitment rounds, newest first, with application counts' })
  @ApiOkResponse({ type: RecruitmentRoundDto, isArray: true })
  rounds(): Promise<RecruitmentRoundDto[]> {
    return this.manager.rounds();
  }

  @Post('tutor-applications/recruitment')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open tutor applications (starts a new round)' })
  @ApiOkResponse({ type: RecruitmentStatusDto })
  open(@Body() dto: RecruitmentSettingsDto): Promise<RecruitmentStatusDto> {
    return this.manager.open(dto);
  }

  @Patch('tutor-applications/recruitment')
  @Roles('admin')
  @ApiOperation({ summary: 'Change the open round: closing date, message, subjects needed, police clearance' })
  @ApiOkResponse({ type: RecruitmentStatusDto })
  update(@Body() dto: RecruitmentSettingsDto): Promise<RecruitmentStatusDto> {
    return this.manager.update(dto);
  }

  @Post('tutor-applications/recruitment/close')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close tutor applications now' })
  @ApiOkResponse({ type: RecruitmentStatusDto })
  close(): Promise<RecruitmentStatusDto> {
    return this.manager.close();
  }

  // Applicant ----------------------------------------------------------------------

  @Post('tutor-applications')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(5, 60_000)
  @ApiOperation({ summary: 'Apply to teach (signed in). Files the confirmed uploads under the application' })
  @ApiCreatedResponse({ type: SubmittedApplicationDto })
  submit(@Body() dto: SubmitTutorApplicationDto): Promise<SubmittedApplicationDto> {
    return this.manager.submit(dto);
  }

  @Get('tutor-applications/me')
  @ApiOperation({ summary: "The signed-in user's latest tutor application, or null" })
  mine(@CurrentUser() actor: AuthUser): Promise<OwnApplication | null> {
    return this.manager.mine(actor);
  }

  @Post('tutor-applications/me/:id/withdraw')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Withdraw an application that has not been reviewed yet' })
  @ApiNoContentResponse()
  withdraw(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.manager.withdraw(id);
  }

  @Post('tutor-applications/me/police-clearance')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Upload a police clearance certificate: to an application under review, or as a tutor after approval',
  })
  @ApiNoContentResponse()
  addPoliceClearance(@Body() dto: PoliceClearanceUploadDto): Promise<void> {
    return this.manager.addPoliceClearance(dto);
  }

  // Review ---------------------------------------------------------------------------

  @Get('tutor-applications')
  @Roles('admin')
  @ApiOperation({ summary: 'Tutor applications, newest first' })
  @ApiOkResponse({ type: TutorApplicationSummaryDto, isArray: true })
  list(@Query() query: ListApplicationsQueryDto): Promise<TutorApplicationSummaryDto[]> {
    return this.manager.list(query);
  }

  @Get('tutor-applications/retention/due')
  @Roles('admin')
  @ApiOperation({ summary: 'Unsuccessful applications past their 12-month retention, oldest first (POPIA)' })
  @ApiOkResponse({ type: RetentionDueDto, isArray: true })
  retentionDue(): Promise<RetentionDueDto[]> {
    return this.manager.retentionDue();
  }

  @Post('tutor-applications/:id/purge')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an application that is due, with its ID, selfie and documents; logged in data_retention_log',
  })
  @ApiOkResponse({ type: PurgeResultDto })
  purge(@Param('id', ParseUUIDPipe) id: string): Promise<PurgeResultDto> {
    return this.manager.purge(id);
  }

  @Get('tutor-applications/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'One application with competencies, references and 5-minute document links' })
  @ApiOkResponse({ type: TutorApplicationDetailDto })
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<TutorApplicationDetailDto> {
    return this.manager.detail(id);
  }

  @Patch('tutor-applications/:id/status')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Shortlist or reject; the applicant is notified' })
  @ApiNoContentResponse()
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetApplicationStatusDto): Promise<void> {
    return this.manager.setStatus(id, dto.status, dto.note);
  }

  @Post('tutor-applications/:id/identity-checked')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record that the ID photo and selfie were compared and match' })
  @ApiNoContentResponse()
  identityChecked(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.manager.markIdentityChecked(id);
  }

  @Post('tutor-applications/:id/approve')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve: the applicant becomes a suspended tutor with their competencies, documents and references',
  })
  @ApiOkResponse({ type: ApproveApplicationResultDto })
  approve(@Param('id', ParseUUIDPipe) id: string): Promise<ApproveApplicationResultDto> {
    return this.manager.approve(id);
  }

  @Post('tutor-applications/:id/request-police-clearance')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ask an applicant for a police clearance certificate' })
  @ApiNoContentResponse()
  requestForApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestPoliceClearanceDto,
  ): Promise<void> {
    return this.manager.requestPoliceClearance({ applicationId: id }, dto.note);
  }

  @Post('tutors/:id/request-police-clearance')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ask a tutor for a police clearance certificate' })
  @ApiNoContentResponse()
  requestForTutor(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestPoliceClearanceDto): Promise<void> {
    return this.manager.requestPoliceClearance({ tutorId: id }, dto.note);
  }
}
