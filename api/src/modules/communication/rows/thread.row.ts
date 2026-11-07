/** `v_my_threads` (`db/migrations/20261020000021_messaging.sql`). `unread_count` is a `count(*)` subquery, confirmed `bigint` via `pg_attribute` — arrives as a string, parsed to `number` in the mapper. */
export interface ThreadRow {
  id: string;
  subject: string;
  learner_id: string | null;
  learner_name: string | null;
  created_at: Date;
  last_message_at: Date | null;
  last_message: string | null;
  unread_count: string;
}

export interface MessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: Date;
}

export interface ThreadParticipantRow {
  thread_id: string;
  profile_id: string;
  added_at: Date;
}
