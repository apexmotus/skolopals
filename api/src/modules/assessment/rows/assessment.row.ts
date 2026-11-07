/** Embedded, not a separate endpoint — a scoreless assessment is useless, so the client always gets scores with the assessment. */
export interface AssessmentScoreRow {
  id: string;
  domain_code: string;
  raw_score: string | null;
  max_score: string | null;
  achievement_level_code: number | null;
  comment: string;
  /** `numeric` generated column — `pg` returns `numeric` as a string to avoid float precision loss; parsed to `number` in the mapper (safe at this scale, unlike money/cents). */
  percent: string | null;
}

export interface AssessmentRow {
  id: string;
  learner_id: string;
  assessment_type_code: string;
  subject_code: string | null;
  grade_code: string;
  term_id: string | null;
  administered_by: string | null;
  assessed_on: string;
  overall_level_code: number | null;
  notes: string;
  created_at: Date;
  /** Built with `json_agg` in the repository SQL — `pg` parses `json`/`jsonb` columns natively, no custom type parser needed (unlike `date`). */
  scores: AssessmentScoreRow[];
}
