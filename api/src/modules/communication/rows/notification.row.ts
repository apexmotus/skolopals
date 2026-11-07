export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  created_by: string | null;
  created_at: Date;
  /** From the joined `notification_recipients` row for the actor doing the listing — this is "my" copy's read state, not a column on `notifications` itself. */
  read_at: Date | null;
}
