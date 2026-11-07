/** `public.v_public_timetable` — deliberately omits `meeting_url`; see the view's own comment in `db/migrations/20261020000008_rls.sql`. */
export interface PublicTimetableRow {
  class_group_id: string;
  class_name: string;
  subject: string;
  language: string;
  delivery_mode: string;
  capacity: number;
  day_of_week: number;
  starts_at_time: string;
  ends_at_time: string;
  tutor_slug: string;
  tutor_name: string;
}
