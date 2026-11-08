import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { CommunicationMapper } from './communication.mapper.js';
import { CommunicationRepository } from './communication.repository.js';
import type {
  AddParticipantDto,
  StartThreadDto,
  ThreadDto,
  ThreadParticipantDto,
} from './dto/thread.dto.js';
import type { MarkThreadReadResultDto, MessageDto, PostMessageDto } from './dto/message.dto.js';
import type { CreateNotificationDto, NotificationDto } from './dto/notification.dto.js';

/** No caching anywhere (`03-endpoints-and-business-rules.md` §communication: "needs to be live"). */
@Injectable()
export class CommunicationManager {
  constructor(private readonly repo: CommunicationRepository) {}

  async listMyThreads(): Promise<ThreadDto[]> {
    const rows = await this.repo.listMyThreads();
    return rows.map((row) => CommunicationMapper.threadToDto(row));
  }

  /** The caller's identity flows through RLS (`auth.uid()` inside `start_thread`), never an app-layer param — there's nothing for an `actor` argument to do here. */
  async startThread(dto: StartThreadDto): Promise<ThreadDto> {
    const threadId = await this.repo.startThread({
      subject: dto.subject,
      body: dto.body,
      participantIds: dto.participantIds,
      learnerId: dto.learnerId,
    });
    const thread = await this.repo.getThreadById(threadId);
    if (!thread) throw new Error('Freshly started thread could not be re-read');
    return CommunicationMapper.threadToDto(thread);
  }

  /** The "not a participant" and "thread doesn't exist" cases are otherwise indistinguishable from an empty list — see the Repository's own doc comment on why this is unreachable in practice but still the correct check to make. */
  async listMessages(threadId: string): Promise<MessageDto[]> {
    if (!(await this.repo.threadIsVisible(threadId))) {
      throw new NotFoundException('Thread not found.');
    }
    const rows = await this.repo.listMessages(threadId);
    return rows.map((row) => CommunicationMapper.messageToDto(row));
  }

  async postMessage(threadId: string, actor: AuthUser, dto: PostMessageDto): Promise<MessageDto> {
    const row = await this.repo.postMessage(threadId, actor.id, dto.body);
    return CommunicationMapper.messageToDto(row);
  }

  async markThreadRead(threadId: string): Promise<MarkThreadReadResultDto> {
    const markedCount = await this.repo.markThreadRead(threadId);
    return { markedCount };
  }

  async addParticipant(threadId: string, dto: AddParticipantDto): Promise<ThreadParticipantDto> {
    const row = await this.repo.addParticipant(threadId, dto.profileId);
    return CommunicationMapper.participantToDto(row);
  }

  async listMyNotifications(actor: AuthUser): Promise<NotificationDto[]> {
    const rows = await this.repo.listMyNotifications(actor.id);
    return rows.map((row) => CommunicationMapper.notificationToDto(row));
  }

  /** Exactly one of `broadcast`/`recipientIds` — see the DTO's own doc comment on why this is checked here, not with a class-validator decorator. */
  async createNotification(actor: AuthUser, dto: CreateNotificationDto): Promise<void> {
    const hasBroadcast = dto.broadcast === true;
    const hasRecipients = !!dto.recipientIds?.length;
    if (hasBroadcast === hasRecipients) {
      throw new BadRequestException('Specify exactly one of "broadcast" or "recipientIds".');
    }

    const notificationId = await this.repo.createNotification({
      title: dto.title,
      body: dto.body,
      createdBy: actor.id,
    });
    if (hasBroadcast) {
      await this.repo.fanOutToAllProfiles(notificationId);
    } else {
      await this.repo.fanOutToRecipients(notificationId, dto.recipientIds ?? []);
    }
  }

  async markNotificationRead(notificationId: string, actor: AuthUser): Promise<NotificationDto> {
    const row = await this.repo.markNotificationRead(notificationId, actor.id);
    if (!row) throw new NotFoundException('Notification not found, or you are not a recipient.');
    return CommunicationMapper.notificationToDto(row);
  }
}
