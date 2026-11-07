import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AttendanceManager } from './attendance.manager';
import { AttendanceRecordDto, CorrectAttendanceDto, MarkAttendanceDto } from './dto/attendance-record.dto';
import { RecordCheckInDto, SessionCheckInDto, SignOutCheckInDto } from './dto/session-check-in.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller()
export class AttendanceController {
  constructor(private readonly manager: AttendanceManager) {}

  @Get('class-sessions/:id/attendance')
  @ApiOperation({ summary: 'List attendance for a session (enrolled guardian, teaching tutor, or admin)' })
  @ApiOkResponse({ type: AttendanceRecordDto, isArray: true })
  listAttendance(@Param('id', ParseUUIDPipe) id: string): Promise<AttendanceRecordDto[]> {
    return this.manager.listAttendance(id);
  }

  @Post('class-sessions/:id/attendance')
  @Roles('admin', 'tutor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Mark a learner's attendance (the session's own tutor/substitute, or admin)" })
  @ApiCreatedResponse({ type: AttendanceRecordDto })
  markAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: MarkAttendanceDto,
  ): Promise<AttendanceRecordDto> {
    return this.manager.markAttendance(id, actor, dto);
  }

  @Patch('class-sessions/:id/attendance/:recordId')
  @Roles('admin', 'tutor')
  @ApiOperation({ summary: 'Correct an attendance record' })
  @ApiOkResponse({ type: AttendanceRecordDto })
  correctAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: CorrectAttendanceDto,
  ): Promise<AttendanceRecordDto> {
    return this.manager.correctAttendance(id, recordId, actor, dto);
  }

  @Get('class-sessions/:id/check-ins')
  @ApiOperation({
    summary: 'List sign-in/out records for a session (guardian — private tier, teaching tutor, or admin)',
  })
  @ApiOkResponse({ type: SessionCheckInDto, isArray: true })
  listCheckIns(@Param('id', ParseUUIDPipe) id: string): Promise<SessionCheckInDto[]> {
    return this.manager.listCheckIns(id);
  }

  @Post('class-sessions/:id/check-ins')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Sign a learner in (front-desk function, BP §22)' })
  @ApiCreatedResponse({ type: SessionCheckInDto })
  signIn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: RecordCheckInDto,
  ): Promise<SessionCheckInDto> {
    return this.manager.signIn(id, actor, dto);
  }

  @Patch('class-sessions/:id/check-ins/:checkInId')
  @Roles('admin')
  @ApiOperation({
    summary: "Sign a learner out — rejected unless the collector is on the learner's active authorised list",
  })
  @ApiOkResponse({ type: SessionCheckInDto })
  signOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('checkInId', ParseUUIDPipe) checkInId: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: SignOutCheckInDto,
  ): Promise<SessionCheckInDto> {
    return this.manager.signOut(id, checkInId, actor, dto);
  }
}
