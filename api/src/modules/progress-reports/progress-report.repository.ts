import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param';
import { StoredProcRunner } from '../../database/stored-proc.runner';
import type { ProgressReportRow } from './rows/progress-report.row';

const REPORT_COLUMNS_WITH_DETAIL = `
  r.id, r.learner_id, r.term_id, r.tutor_id, r.summary, r.attendance_note,
  r.issued_on, r.published_at, r.created_by, r.created_at,
  coalesce(
    (select json_agg(json_build_object(
       'id', rs.id, 'subject_code', rs.subject_code,
       'achievement_level_code', rs.achievement_level_code, 'strengths', rs.strengths,
       'areas_for_improvement', rs.areas_for_improvement,
       'recommended_intervention', rs.recommended_intervention
     ) order by rs.subject_code)
     from public.progress_report_subjects rs where rs.progress_report_id = r.id),
    '[]'::json
  ) as subjects,
  coalesce(
    (select json_agg(json_build_object(
       'guardian_id', ra.guardian_id, 'acknowledged_at', ra.acknowledged_at, 'comment', ra.comment
     ) order by ra.acknowledged_at)
     from public.report_acknowledgements ra where ra.progress_report_id = r.id),
    '[]'::json
  ) as acknowledgements
`;

export interface SaveProgressReportPayload {
  learnerId: string;
  termId: string;
  summary?: string;
  attendanceNote?: string;
  publish: boolean;
  subjects: Record<string, unknown>[];
}

/**
 * `save_progress_report` (`db/migrations/20261020000019_assessment_rpcs.sql`)
 * already upserts the report, wholesale-replaces its subjects, and applies
 * the one-way publish transition in one transaction — same reasoning as
 * `AssessmentRepository`'s functions. `report_acknowledgements` has no
 * dedicated function (confirmed by grep): a plain INSERT under RLS +
 * `check_ack_published` + (after this phase's fix) the guardian-of-this-
 * learner check in "acks: guardian acknowledges".
 */
@Injectable()
export class ProgressReportRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  listByLearner(learnerId: string): Promise<ProgressReportRow[]> {
    return this.sp.selectMany<ProgressReportRow>(
      `select ${REPORT_COLUMNS_WITH_DETAIL}
       from public.progress_reports r
       where r.learner_id = $1
       order by r.created_at desc`,
      [learnerId],
    );
  }

  getById(id: string): Promise<ProgressReportRow | undefined> {
    return this.sp.selectOne<ProgressReportRow>(
      `select ${REPORT_COLUMNS_WITH_DETAIL} from public.progress_reports r where r.id = $1`,
      [id],
    );
  }

  async save(payload: SaveProgressReportPayload): Promise<string> {
    const row = await this.sp.queryOne<{ save_progress_report: string }>(
      'public.save_progress_report',
      [
        p.uuid('p_learner_id', payload.learnerId),
        p.uuid('p_term_id', payload.termId),
        p.text('p_summary', payload.summary ?? ''),
        p.jsonb('p_subjects', payload.subjects),
        p.bool('p_publish', payload.publish),
        p.text('p_attendance_note', payload.attendanceNote ?? ''),
      ],
    );
    if (!row)
      throw new Error('save_progress_report unexpectedly returned no row');
    return row.save_progress_report;
  }

  async acknowledge(
    progressReportId: string,
    guardianId: string,
    comment?: string,
  ): Promise<{ guardian_id: string; acknowledged_at: Date; comment: string }> {
    const result = await this.sp.executeRaw<{
      guardian_id: string;
      acknowledged_at: Date;
      comment: string;
    }>(
      `insert into public.report_acknowledgements (progress_report_id, guardian_id, comment)
       values ($1, $2, coalesce($3, ''))
       returning guardian_id, acknowledged_at, comment`,
      [progressReportId, guardianId, comment ?? null],
    );
    const insertedRow = result.rows[0];
    if (!insertedRow)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return insertedRow;
  }
}
