import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { CommunicationManager } from './communication.manager';
import { MarkThreadReadResultDto, MessageDto, PostMessageDto } from './dto/message.dto';
import { CreateNotificationDto, NotificationDto } from './dto/notification.dto';
import { AddParticipantDto, StartThreadDto, ThreadDto, ThreadParticipantDto } from './dto/thread.dto';

/**
 * Most routes here carry no `@Roles(...)`: "participant" and "recipient"
 * are entitlements determined by membership rows RLS checks, not one of
 * this app's four roles (`admin`/`tutor`/`parent`/`learner`) — only
 * `POST /notifications` names a real role. Every other route still requires
 * a valid session (no `@Public()` either); RLS, backed by the Manager's own
 * 404 checks on an invisible thread/notification, is the actual gate.
 */
@ApiTags('communication')
@ApiBearerAuth()
@Controller()
export class CommunicationController {
  constructor(private readonly manager: CommunicationManager) {}

  @Get('threads')
  @ApiOperation({ summary: "List the caller's conversations, with unread counts" })
  @ApiOkResponse({ type: ThreadDto, isArray: true })
  listMyThreads(): Promise<ThreadDto[]> {
    return this.manager.listMyThreads();
  }

  @Post('threads')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a conversation (creates the thread, adds participants, posts the first message)' })
  @ApiCreatedResponse({ type: ThreadDto })
  startThread(@Body() dto: StartThreadDto): Promise<ThreadDto> {
    return this.manager.startThread(dto);
  }

  @Get('threads/:id/messages')
  @ApiOperation({ summary: "List a thread's messages (a participant, or admin)" })
  @ApiOkResponse({ type: MessageDto, isArray: true })
  listMessages(@Param('id', ParseUUIDPipe) id: string): Promise<MessageDto[]> {
    return this.manager.listMessages(id);
  }

  @Post('threads/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post a message into a thread (a participant only)' })
  @ApiCreatedResponse({ type: MessageDto })
  postMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: PostMessageDto,
  ): Promise<MessageDto> {
    return this.manager.postMessage(id, actor, dto);
  }

  @Post('threads/:id/read')
  @ApiOperation({ summary: 'Mark every unread message in a thread as read by the caller' })
  @ApiOkResponse({ type: MarkThreadReadResultDto })
  markThreadRead(@Param('id', ParseUUIDPipe) id: string): Promise<MarkThreadReadResultDto> {
    return this.manager.markThreadRead(id);
  }

  @Post('threads/:id/participants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a participant to a thread (a participant, or admin)' })
  @ApiCreatedResponse({ type: ThreadParticipantDto })
  addParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddParticipantDto,
  ): Promise<ThreadParticipantDto> {
    return this.manager.addParticipant(id, dto);
  }

  @Get('notifications')
  @ApiOperation({ summary: "List the caller's notifications" })
  @ApiOkResponse({ type: NotificationDto, isArray: true })
  listMyNotifications(@CurrentUser() actor: AuthUser): Promise<NotificationDto[]> {
    return this.manager.listMyNotifications(actor);
  }

  @Post('notifications')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Create a notification — broadcast to everyone, or a targeted list' })
  @ApiNoContentResponse()
  createNotification(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateNotificationDto,
  ): Promise<void> {
    return this.manager.createNotification(actor, dto);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: "Mark one of the caller's notifications as read" })
  @ApiOkResponse({ type: NotificationDto })
  markNotificationRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<NotificationDto> {
    return this.manager.markNotificationRead(id, actor);
  }
}
