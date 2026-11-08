import {
  Body,
  Controller,
  Delete,
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
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ClassEnrolmentDto, PlaceLearnerDto } from './dto/class-enrolment.dto.js';
import {
  ClassGroupDto,
  CreateClassGroupDto,
  ListClassGroupsQueryDto,
  UpdateClassGroupDto,
} from './dto/class-group.dto.js';
import { AddClassScheduleDto, ClassScheduleDto } from './dto/class-schedule.dto.js';
import {
  ClassSessionDto,
  ListClassSessionsQueryDto,
  UpdateClassSessionStatusDto,
} from './dto/class-session.dto.js';
import { PublicTimetableEntryDto } from './dto/public-timetable.dto.js';
import { TimetableManager } from './timetable.manager.js';

@ApiTags('timetable')
@ApiBearerAuth()
@Controller()
export class TimetableController {
  constructor(private readonly manager: TimetableManager) {}

  @Get('timetable/public')
  @Public()
  @ApiOperation({ summary: 'Published class timetable (never includes meetingUrl)' })
  @ApiOkResponse({ type: PublicTimetableEntryDto, isArray: true })
  getPublicTimetable(): Promise<PublicTimetableEntryDto[]> {
    return this.manager.getPublicTimetable();
  }

  @Get('class-groups')
  @Public()
  @ApiOperation({ summary: 'List class groups (active only, unless admin)' })
  @ApiOkResponse({ type: ClassGroupDto, isArray: true })
  listClassGroups(
    @Query() query: ListClassGroupsQueryDto,
    @CurrentUser() actor?: AuthUser,
  ): Promise<ClassGroupDto[]> {
    return this.manager.listClassGroups(query, actor);
  }

  @Get('class-groups/:id')
  @Public()
  @ApiOperation({ summary: 'Get a class group by id' })
  @ApiOkResponse({ type: ClassGroupDto })
  getClassGroupById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor?: AuthUser,
  ): Promise<ClassGroupDto> {
    return this.manager.getClassGroupById(id, actor);
  }

  @Post('class-groups')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a class group (tutor competency pre-checked for every covered grade)',
  })
  @ApiCreatedResponse({ type: ClassGroupDto })
  createClassGroup(@Body() dto: CreateClassGroupDto): Promise<ClassGroupDto> {
    return this.manager.createClassGroup(dto);
  }

  @Patch('class-groups/:id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Update a class group (competency re-checked if subject/language/tutor/grades change)',
  })
  @ApiOkResponse({ type: ClassGroupDto })
  updateClassGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassGroupDto,
  ): Promise<ClassGroupDto> {
    return this.manager.updateClassGroup(id, dto);
  }

  @Post('class-groups/:id/schedules')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a weekly time slot (rejected outside centre operating hours for an in-centre class)',
  })
  @ApiCreatedResponse({ type: ClassScheduleDto })
  addSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddClassScheduleDto,
  ): Promise<ClassScheduleDto> {
    return this.manager.addSchedule(id, dto);
  }

  @Delete('class-groups/:id/schedules/:scheduleId')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a weekly time slot' })
  async removeSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ): Promise<void> {
    await this.manager.removeSchedule(id, scheduleId);
  }

  @Post('class-groups/:id/generate-sessions')
  @Roles('admin')
  @ApiOperation({ summary: "Materialise the term's sessions from the weekly schedule (idempotent)" })
  @ApiOkResponse()
  generateSessions(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ sessionsCreated: number }> {
    return this.manager.generateSessions(id);
  }

  @Get('class-sessions')
  @ApiOperation({
    summary: 'List sessions visible to the signed-in actor (own/taught, enrolled, or admin)',
  })
  @ApiOkResponse({ type: ClassSessionDto, isArray: true })
  listSessions(@Query() query: ListClassSessionsQueryDto) {
    return this.manager.listSessionsForParticipant(query);
  }

  @Patch('class-sessions/:id')
  @Roles('admin', 'tutor')
  @ApiOperation({
    summary: 'Mark a session held/cancelled, or add notes/a meeting link (admin or the teaching tutor)',
  })
  @ApiOkResponse({ type: ClassSessionDto })
  updateSessionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassSessionStatusDto,
  ): Promise<ClassSessionDto> {
    return this.manager.updateSessionStatus(id, dto);
  }

  @Get('class-groups/:id/enrolments')
  @Roles('admin', 'tutor')
  @ApiOperation({ summary: 'List learners placed in a class group' })
  @ApiOkResponse({ type: ClassEnrolmentDto, isArray: true })
  listPlacements(@Param('id', ParseUUIDPipe) id: string): Promise<ClassEnrolmentDto[]> {
    return this.manager.listPlacements(id);
  }

  @Post('class-groups/:id/enrolments')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Place a learner into a class group (capacity-checked under lock)' })
  @ApiCreatedResponse({ type: ClassEnrolmentDto })
  placeLearner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlaceLearnerDto,
  ): Promise<ClassEnrolmentDto> {
    return this.manager.placeLearner(id, dto);
  }

  @Post('class-groups/:id/enrolments/:enrolmentId/withdraw')
  @Roles('admin')
  @ApiOperation({ summary: 'Withdraw a placement (sets leftOn)' })
  @ApiOkResponse({ type: ClassEnrolmentDto })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('enrolmentId', ParseUUIDPipe) enrolmentId: string,
  ): Promise<ClassEnrolmentDto> {
    return this.manager.withdraw(id, enrolmentId);
  }
}
