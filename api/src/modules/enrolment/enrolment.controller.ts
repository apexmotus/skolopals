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
import { EnrolmentDto, ListEnrolmentsQueryDto } from './dto/enrolment.dto.js';
import { SubmitEnrolmentDto } from './dto/submit-enrolment.dto.js';
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

  @Post(':id/activate')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Approve a pending enrolment, assign a tutor, and (once per learner) raise the registration invoice',
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
  @ApiOperation({ summary: 'Decline a pending enrolment' })
  @ApiOkResponse({ type: EnrolmentDto })
  decline(@Param('id', ParseUUIDPipe) id: string): Promise<EnrolmentDto> {
    return this.manager.decline(id);
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
