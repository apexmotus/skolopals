/** Embedded, not a separate list endpoint. */
export interface LearningPlanGoalRow {
  id: string;
  subject_code: string;
  goal: string;
  target_level_code: number | null;
  target_date: string | null;
  status: string;
  review_note: string;
}

/** The standalone shape returned by `PATCH /learning-plans/:id/goals/:goalId` — same columns, plus the plan id it was scoped by. */
export interface LearningPlanGoalUpdateRow extends LearningPlanGoalRow {
  learning_plan_id: string;
}

export interface LearningPlanRow {
  id: string;
  learner_id: string;
  from_assessment_id: string | null;
  term_id: string | null;
  status: string;
  created_by: string | null;
  created_at: Date;
  activated_at: Date | null;
  /** Built with `json_agg` in the repository SQL, same as `AssessmentRow.scores`. */
  goals: LearningPlanGoalRow[];
}
