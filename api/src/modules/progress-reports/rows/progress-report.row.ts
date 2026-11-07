/** Embedded, not a separate list endpoint — a report is read as one document. */
export interface ProgressReportSubjectRow {
  id: string;
  subject_code: string;
  achievement_level_code: number | null;
  strengths: string;
  areas_for_improvement: string;
  recommended_intervention: string;
}

/**
 * Embedded — "who has seen this report" is part of the report, not a
 * separate resource in the endpoint table. `acknowledged_at` is a plain
 * `timestamptz` column, but here it travels through `json_build_object` ->
 * `json_agg`, not as its own result column — `pg`'s `timestamptz` type
 * parser only runs on a query's own typed columns, never on values nested
 * inside a `json`/`jsonb` payload, so Postgres's own JSON serialization
 * already gave us an ISO-8601 string. Caught live (2026-11-07): mapping this
 * as `Date` and calling `.toISOString()` on it crashed with "not a
 * function" — the top-level `ProgressReportRow.published_at`/`created_at`
 * (direct columns, not nested in json_agg) are unaffected and stay `Date`.
 */
export interface ReportAcknowledgementRow {
  guardian_id: string;
  acknowledged_at: string;
  comment: string;
}

export interface ProgressReportRow {
  id: string;
  learner_id: string;
  term_id: string;
  tutor_id: string | null;
  summary: string;
  attendance_note: string;
  issued_on: string | null;
  published_at: Date | null;
  created_by: string | null;
  created_at: Date;
  subjects: ProgressReportSubjectRow[];
  acknowledgements: ReportAcknowledgementRow[];
}
