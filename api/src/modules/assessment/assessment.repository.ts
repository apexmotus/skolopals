import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param';
import { StoredProcRunner } from '../../database/stored-proc.runner';
import type { AssessmentRow } from './rows/assessment.row';
import type {
  LearningPlanGoalUpdateRow,
  LearningPlanRow,
} from './rows/learning-plan.row';

const ASSESSMENT_COLUMNS_WITH_SCORES = `
  a.id, a.learner_id, a.assessment_type_code, a.subject_code, a.grade_code, a.term_id,
  a.administered_by, a.assessed_on, a.overall_level_code, a.notes, a.created_at,
  coalesce(
    (select json_agg(json_build_object(
       'id', s.id, 'domain_code', s.domain_code, 'raw_score', s.raw_score,
       'max_score', s.max_score, 'achievement_level_code', s.achievement_level_code,
       'comment', s.comment, 'percent', s.percent
     ) order by s.domain_code)
     from public.assessment_scores s where s.assessment_id = a.id),
    '[]'::json
  ) as scores
`;

const LEARNING_PLAN_COLUMNS_WITH_GOALS = `
  lp.id, lp.learner_id, lp.from_assessment_id, lp.term_id, lp.status,
  lp.created_by, lp.created_at, lp.activated_at,
  coalesce(
    (select json_agg(json_build_object(
       'id', g.id, 'subject_code', g.subject_code, 'goal', g.goal,
       'target_level_code', g.target_level_code, 'target_date', g.target_date,
       'status', g.status, 'review_note', g.review_note
     ) order by g.subject_code)
     from public.learning_plan_goals g where g.learning_plan_id = lp.id),
    '[]'::json
  ) as goals
`;

export interface RecordAssessmentPayload {
  learnerId: string;
  assessmentTypeCode: string;
  gradeCode: string;
  assessedOn: string;
  scores: Record<string, unknown>[];
  subjectCode?: string;
  termId?: string;
  notes?: string;
}

export interface CreateLearningPlanPayload {
  learnerId: string;
  goals: Record<string, unknown>[];
  fromAssessmentId?: string;
  termId?: string;
}

/**
 * `record_assessment`/`create_learning_plan`
 * (`db/migrations/20261020000019_assessment_rpcs.sql`) are the existing
 * all-or-nothing Postgres functions this module was built around — same
 * shape as `enrolment`'s `submit_enrolment`. Both already resolve the
 * teaching-tutor check and the achievement-level banding internally; this
 * Repository only assembles jsonb payloads and calls through, then reads
 * the full row back (with its scores/goals embedded via `json_agg`) for the
 * response, since neither function's own `returns uuid` includes them.
 *
 * `learning_plan_goals`' status update has no dedicated function (confirmed
 * by grep) — plain parameterized UPDATE under the existing
 * "plan_goals: tutor writes"/"plan_goals: admin write" RLS policies.
 */
@Injectable()
export class AssessmentRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  listAssessments(learnerId: string): Promise<AssessmentRow[]> {
    return this.sp.selectMany<AssessmentRow>(
      `select ${ASSESSMENT_COLUMNS_WITH_SCORES}
       from public.assessments a
       where a.learner_id = $1
       order by a.assessed_on desc, a.created_at desc`,
      [learnerId],
    );
  }

  getAssessmentById(id: string): Promise<AssessmentRow | undefined> {
    return this.sp.selectOne<AssessmentRow>(
      `select ${ASSESSMENT_COLUMNS_WITH_SCORES} from public.assessments a where a.id = $1`,
      [id],
    );
  }

  async recordAssessment(payload: RecordAssessmentPayload): Promise<string> {
    const row = await this.sp.queryOne<{ record_assessment: string }>(
      'public.record_assessment',
      [
        p.uuid('p_learner_id', payload.learnerId),
        p.text('p_type', payload.assessmentTypeCode),
        p.text('p_grade_code', payload.gradeCode),
        p.date('p_assessed_on', payload.assessedOn),
        p.jsonb('p_scores', payload.scores),
        p.text('p_subject', payload.subjectCode ?? null),
        p.uuid('p_term_id', payload.termId ?? null),
        p.text('p_notes', payload.notes ?? ''),
      ],
    );
    if (!row) throw new Error('record_assessment unexpectedly returned no row');
    return row.record_assessment;
  }

  listLearningPlans(learnerId: string): Promise<LearningPlanRow[]> {
    return this.sp.selectMany<LearningPlanRow>(
      `select ${LEARNING_PLAN_COLUMNS_WITH_GOALS}
       from public.learning_plans lp
       where lp.learner_id = $1
       order by lp.created_at desc`,
      [learnerId],
    );
  }

  getLearningPlanById(id: string): Promise<LearningPlanRow | undefined> {
    return this.sp.selectOne<LearningPlanRow>(
      `select ${LEARNING_PLAN_COLUMNS_WITH_GOALS} from public.learning_plans lp where lp.id = $1`,
      [id],
    );
  }

  async createLearningPlan(payload: CreateLearningPlanPayload): Promise<string> {
    const row = await this.sp.queryOne<{ create_learning_plan: string }>(
      'public.create_learning_plan',
      [
        p.uuid('p_learner_id', payload.learnerId),
        p.jsonb('p_goals', payload.goals),
        p.uuid('p_assessment_id', payload.fromAssessmentId ?? null),
        p.uuid('p_term_id', payload.termId ?? null),
      ],
    );
    if (!row)
      throw new Error('create_learning_plan unexpectedly returned no row');
    return row.create_learning_plan;
  }

  async updateGoalStatus(
    learningPlanId: string,
    goalId: string,
    patch: { status: string; reviewNote?: string },
  ): Promise<LearningPlanGoalUpdateRow | undefined> {
    const values: unknown[] = [patch.status];
    const sets = ['status = $1'];
    if (patch.reviewNote !== undefined) {
      values.push(patch.reviewNote);
      sets.push(`review_note = $${values.length}`);
    }
    values.push(goalId, learningPlanId);
    const result = await this.sp.executeRaw<LearningPlanGoalUpdateRow>(
      `update public.learning_plan_goals set ${sets.join(', ')}
       where id = $${values.length - 1} and learning_plan_id = $${values.length}
       returning id, learning_plan_id, subject_code, goal, target_level_code, target_date, status, review_note`,
      values,
    );
    return result.rows[0];
  }
}
