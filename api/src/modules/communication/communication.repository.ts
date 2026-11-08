import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param.js';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { NotificationRow } from './rows/notification.row.js';
import type { MessageRow, ThreadParticipantRow, ThreadRow } from './rows/thread.row.js';

const MESSAGE_COLUMNS = 'id, thread_id, sender_id, body, created_at';

/**
 * `start_thread`/`mark_thread_read` (`db/migrations/20261020000021_messaging.sql`)
 * are the only real functions this module touches — everything else
 * (posting into an existing thread, adding a participant, notifications,
 * their fan-out) is plain parameterized SQL under RLS, confirmed by grep.
 * `messages`/`thread_participants` have genuinely no update path anywhere
 * in this Repository — append-only, by design, not an oversight.
 */
@Injectable()
export class CommunicationRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  listMyThreads(): Promise<ThreadRow[]> {
    return this.sp.selectMany<ThreadRow>(
      `select id, subject, learner_id, learner_name, created_at, last_message_at, last_message, unread_count
       from public.v_my_threads
       order by coalesce(last_message_at, created_at) desc`,
    );
  }

  getThreadById(threadId: string): Promise<ThreadRow | undefined> {
    return this.sp.selectOne<ThreadRow>(
      `select id, subject, learner_id, learner_name, created_at, last_message_at, last_message, unread_count
       from public.v_my_threads
       where id = $1`,
      [threadId],
    );
  }

  /** RLS-visible even when empty, so a 404 pre-check makes an invisible/missing thread distinguishable from a visible-but-genuinely-empty one — not reachable in practice (every thread created through this API already has its first message), but still the correct shape to check. */
  threadIsVisible(threadId: string): Promise<{ id: string } | undefined> {
    return this.sp.selectOne<{ id: string }>(
      'select id from public.message_threads where id = $1',
      [threadId],
    );
  }

  async startThread(input: {
    subject?: string;
    body: string;
    participantIds: string[];
    learnerId?: string;
  }): Promise<string> {
    const row = await this.sp.queryOne<{ start_thread: string }>('public.start_thread', [
      p.text('p_subject', input.subject ?? null),
      p.text('p_body', input.body),
      p.uuidArray('p_participants', input.participantIds),
      p.uuid('p_learner_id', input.learnerId ?? null),
    ]);
    if (!row) throw new Error('start_thread unexpectedly returned no row');
    return row.start_thread;
  }

  listMessages(threadId: string): Promise<MessageRow[]> {
    return this.sp.selectMany<MessageRow>(
      `select ${MESSAGE_COLUMNS} from public.messages where thread_id = $1 order by created_at`,
      [threadId],
    );
  }

  async postMessage(threadId: string, senderId: string, body: string): Promise<MessageRow> {
    const result = await this.sp.executeRaw<MessageRow>(
      `insert into public.messages (thread_id, sender_id, body) values ($1, $2, $3)
       returning ${MESSAGE_COLUMNS}`,
      [threadId, senderId, body],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  async markThreadRead(threadId: string): Promise<number> {
    const row = await this.sp.queryOne<{ mark_thread_read: number }>('public.mark_thread_read', [
      p.uuid('p_thread_id', threadId),
    ]);
    if (!row) throw new Error('mark_thread_read unexpectedly returned no row');
    return row.mark_thread_read;
  }

  async addParticipant(threadId: string, profileId: string): Promise<ThreadParticipantRow> {
    const result = await this.sp.executeRaw<ThreadParticipantRow>(
      `insert into public.thread_participants (thread_id, profile_id) values ($1, $2)
       on conflict do nothing
       returning thread_id, profile_id, added_at`,
      [threadId, profileId],
    );
    const row = result.rows[0];
    if (row) return row;
    // Already a participant — on conflict do nothing returns no row; read it back rather than report a fabricated id.
    const existing = await this.sp.selectOne<ThreadParticipantRow>(
      'select thread_id, profile_id, added_at from public.thread_participants where thread_id = $1 and profile_id = $2',
      [threadId, profileId],
    );
    if (!existing) throw new Error('Participant insert conflicted but the row could not be re-read');
    return existing;
  }

  listMyNotifications(profileId: string): Promise<NotificationRow[]> {
    return this.sp.selectMany<NotificationRow>(
      `select n.id, n.title, n.body, n.created_by, n.created_at, nr.read_at
       from public.notifications n
       join public.notification_recipients nr on nr.notification_id = n.id
       where nr.profile_id = $1
       order by n.created_at desc`,
      [profileId],
    );
  }

  async createNotification(input: { title: string; body?: string; createdBy: string }): Promise<string> {
    const result = await this.sp.executeRaw<{ id: string }>(
      `insert into public.notifications (title, body, created_by) values ($1, coalesce($2, ''), $3)
       returning id`,
      [input.title, input.body ?? null, input.createdBy],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row.id;
  }

  /** One `INSERT ... SELECT`, not a loop of per-profile inserts — atomic and correct regardless of how many profiles exist. */
  async fanOutToAllProfiles(notificationId: string): Promise<void> {
    await this.sp.executeRaw(
      `insert into public.notification_recipients (notification_id, profile_id)
       select $1, id from public.profiles`,
      [notificationId],
    );
  }

  async fanOutToRecipients(notificationId: string, profileIds: string[]): Promise<void> {
    await this.sp.executeRaw(
      `insert into public.notification_recipients (notification_id, profile_id)
       select $1, unnest($2::uuid[])`,
      [notificationId, profileIds],
    );
  }

  async markNotificationRead(
    notificationId: string,
    profileId: string,
  ): Promise<NotificationRow | undefined> {
    const result = await this.sp.executeRaw<{ notification_id: string }>(
      `update public.notification_recipients set read_at = now()
       where notification_id = $1 and profile_id = $2
       returning notification_id`,
      [notificationId, profileId],
    );
    if (!result.rows[0]) return undefined;

    const row = await this.sp.selectOne<NotificationRow>(
      `select n.id, n.title, n.body, n.created_by, n.created_at, nr.read_at
       from public.notifications n
       join public.notification_recipients nr on nr.notification_id = n.id
       where n.id = $1 and nr.profile_id = $2`,
      [notificationId, profileId],
    );
    if (!row) throw new Error('Freshly marked-read notification could not be re-read');
    return row;
  }
}
