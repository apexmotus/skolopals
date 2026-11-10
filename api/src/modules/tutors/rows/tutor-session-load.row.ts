/** From `public.v_tutor_session_load` (a view, `security_invoker = true`). `sessions`/`hours` are `bigint`/`numeric` — `pg` returns both as strings, never auto-parsed. */
export interface TutorSessionLoadRow {
  tutor_id: string;
  month: string;
  sessions: string;
  hours: string;
}
