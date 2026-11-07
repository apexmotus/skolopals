import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  MarkProgrammeAttendanceDto,
  ProgrammeAttendanceDto,
} from './dto/programme-attendance.dto';
import { BookProgrammeDto, ProgrammeEnrolmentDto } from './dto/programme-enrolment.dto';
import { AddProgrammeSessionDto, ProgrammeSessionDto } from './dto/programme-session.dto';
import { CreateProgrammeDto, ProgrammeDto, UpdateProgrammeDto } from './dto/programme.dto';
import { ProgrammesManager } from './programmes.manager';

@ApiTags('programmes')
@ApiBearerAuth()
@Controller()
export class ProgrammesController {
  constructor(private readonly manager: ProgrammesManager) {}

  @Get('programmes')
  @Public()
  @ApiOperation({ summary: 'List programmes (published only, unless admin)' })
  @ApiOkResponse({ type: ProgrammeDto, isArray: true })
  listProgrammes(@CurrentUser() actor?: AuthUser): Promise<ProgrammeDto[]> {
    return this.manager.listProgrammes(actor);
  }

  @Get('programmes/:id')
  @Public()
  @ApiOperation({ summary: 'Get a programme by id' })
  @ApiOkResponse({ type: ProgrammeDto })
  getProgrammeById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor?: AuthUser,
  ): Promise<ProgrammeDto> {
    return this.manager.getProgrammeById(id, actor);
  }

  @Post('programmes')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a programme' })
  @ApiCreatedResponse({ type: ProgrammeDto })
  createProgramme(@Body() dto: CreateProgrammeDto): Promise<ProgrammeDto> {
    return this.manager.createProgramme(dto);
  }

  @Patch('programmes/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update a programme, including the publish toggle' })
  @ApiOkResponse({ type: ProgrammeDto })
  updateProgramme(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgrammeDto,
  ): Promise<ProgrammeDto> {
    return this.manager.updateProgramme(id, dto);
  }

  @Post('programmes/:id/sessions')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a session to a programme' })
  @ApiCreatedResponse({ type: ProgrammeSessionDto })
  addSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProgrammeSessionDto,
  ): Promise<ProgrammeSessionDto> {
    return this.manager.addSession(id, dto);
  }

  @Get('programmes/:id/sessions')
  @ApiOperation({
    summary: "List a programme's sessions (its tutor, a booked learner's guardian, or admin)",
  })
  @ApiOkResponse({ type: ProgrammeSessionDto, isArray: true })
  listSessions(@Param('id', ParseUUIDPipe) id: string): Promise<ProgrammeSessionDto[]> {
    return this.manager.listSessions(id);
  }

  @Get('programmes/:id/enrolments')
  @Roles('admin', 'parent')
  @ApiOperation({ summary: "List a programme's bookings (the booking guardian, or admin)" })
  @ApiOkResponse({ type: ProgrammeEnrolmentDto, isArray: true })
  listBookings(@Param('id', ParseUUIDPipe) id: string): Promise<ProgrammeEnrolmentDto[]> {
    return this.manager.listBookings(id);
  }

  @Post('programmes/:id/enrolments')
  @Roles('parent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Book a learner onto a programme (capacity-checked under lock)' })
  @ApiCreatedResponse({ type: ProgrammeEnrolmentDto })
  book(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookProgrammeDto,
  ): Promise<ProgrammeEnrolmentDto> {
    return this.manager.book(id, dto);
  }

  @Post('programmes/:id/enrolments/:enrolmentId/cancel')
  @Roles('admin', 'parent')
  @ApiOperation({ summary: 'Cancel a booking (the booking guardian, or admin)' })
  @ApiOkResponse({ type: ProgrammeEnrolmentDto })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('enrolmentId', ParseUUIDPipe) enrolmentId: string,
  ): Promise<ProgrammeEnrolmentDto> {
    return this.manager.cancel(id, enrolmentId);
  }

  @Get('programme-sessions/:id/attendance')
  @ApiOperation({
    summary: "List a programme session's attendance (its tutor, the learner's guardian, or admin)",
  })
  @ApiOkResponse({ type: ProgrammeAttendanceDto, isArray: true })
  listAttendance(@Param('id', ParseUUIDPipe) id: string): Promise<ProgrammeAttendanceDto[]> {
    return this.manager.listAttendance(id);
  }

  @Post('programme-sessions/:id/attendance')
  @Roles('admin', 'tutor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Mark a learner's attendance (the session's tutor, or admin)" })
  @ApiCreatedResponse({ type: ProgrammeAttendanceDto })
  markAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: MarkProgrammeAttendanceDto,
  ): Promise<ProgrammeAttendanceDto> {
    return this.manager.markAttendance(id, actor, dto);
  }
}
