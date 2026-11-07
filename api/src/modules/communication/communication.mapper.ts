import type { MessageDto } from './dto/message.dto';
import type { NotificationDto } from './dto/notification.dto';
import type { ThreadDto, ThreadParticipantDto } from './dto/thread.dto';
import type { NotificationRow } from './rows/notification.row';
import type { MessageRow, ThreadParticipantRow, ThreadRow } from './rows/thread.row';

export class CommunicationMapper {
  static threadToDto(row: ThreadRow): ThreadDto {
    return {
      id: row.id,
      subject: row.subject,
      learnerId: row.learner_id ?? undefined,
      learnerName: row.learner_name ?? undefined,
      createdAt: row.created_at,
      lastMessageAt: row.last_message_at ?? undefined,
      lastMessage: row.last_message ?? undefined,
      unreadCount: Number(row.unread_count),
    };
  }

  static messageToDto(row: MessageRow): MessageDto {
    return {
      id: row.id,
      threadId: row.thread_id,
      senderId: row.sender_id,
      body: row.body,
      createdAt: row.created_at,
    };
  }

  static participantToDto(row: ThreadParticipantRow): ThreadParticipantDto {
    return {
      threadId: row.thread_id,
      profileId: row.profile_id,
      addedAt: row.added_at,
    };
  }

  static notificationToDto(row: NotificationRow): NotificationDto {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      createdBy: row.created_by ?? undefined,
      createdAt: row.created_at,
      readAt: row.read_at ?? undefined,
    };
  }
}
