import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param';
import { StoredProcRunner } from '../../database/stored-proc.runner';
import type { ClassEnrolmentRow } from './rows/class-enrolment.row';
import type { ClassGroupRow } from './rows/class-group.row';
import type { ClassScheduleRow } from './rows/class-schedule.row';
import type { ClassSessionRow } from './rows/class-session.row';
import type { PublicTimetableRow } from './rows/public-timetable.row';

const CLASS_GROUP_COLUMNS =
  'id, name, subject_code, language_code, tutor_id, term_id, delivery_mode, room_id, capacity, is_active, created_at';
const CLASS_SCHEDULE_COLUMNS = 'id, class_group_id, day_of_week, starts_at_time, ends_at_time';
const CLASS_SESSION_COLUMNS =
  'id, class_group_id, schedule_id, session_date, starts_at, ends_at, status, tutor_id, meeting_url, notes, created_at';
const CLASS_ENROLMENT_COLUMNS = 'id, class_group_id, learner_id, enrolment_id, joined_on, left_on';

interface ClassGroupPatch {
  name?: string;
  subjectCode?: string;
  languageCode?: string;
  tutorId?: string;
  termId?: string;
  deliveryMode?: string;
  roomId?: string | null;
  capacity?: number;
  isActive?: boolean;
}

interface SessionPatch {
  status?: string;
  notes?: string;
  meetingUrl?: string;
}

interface ListSessionsFilter {
  classGroupId?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  page: number;
  pageSize: number;
}

/**
 * Plain table reads/writes, same convention as `packages`/`people` — the
 * only existing function this module reuses is `generate_class_sessions`
 * (confirmed by grepping `db/migrations/*.sql` for
 * `create or replace function public\.`). The capacity, operating-hours and
 * tutor-competency rules are native triggers (two deferred, one immediate on
 * `class_schedules`), not SPs — `SqlErrorMapper` turns their `check_violation`
 * into a 422 with the trigger's own client-safe message. `class_groups`'
 * `public read: is_active or is_admin()` RLS policy does the admin-sees-
 * inactive-too branching by itself; there is no packages-style Manager
 * branch needed for `listClassGroups`/`getClassGroupById`.
 */
@Injectable()
export class TimetableRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  getPublicTimetable(): Promise<PublicTimetableRow[]> {
    return this.sp.selectMany<PublicTimetableRow>(
      `select class_group_id, class_name, subject, language, delivery_mode, capacity,
              day_of_week, starts_at_time, ends_at_time, tutor_slug, tutor_name
       from public.v_public_timetable
       order by day_of_week, starts_at_time`,
    );
  }

  listClassGroups(filter: { termId?: string; tutorId?: string }): Promise<ClassGroupRow[]> {
    const values: unknown[] = [];
    const clauses: string[] = [];
    if (filter.termId) {
      values.push(filter.termId);
      clauses.push(`term_id = $${values.length}`);
    }
    if (filter.tutorId) {
      values.push(filter.tutorId);
      clauses.push(`tutor_id = $${values.length}`);
    }
    const where = clauses.length > 0 ? `where ${clauses.join(' and ')}` : '';
    return this.sp.selectMany<ClassGroupRow>(
      `select ${CLASS_GROUP_COLUMNS} from public.class_groups ${where} order by created_at`,
      values,
    );
  }

  getClassGroupById(id: string): Promise<ClassGroupRow | undefined> {
    return this.sp.selectOne<ClassGroupRow>(
      `select ${CLASS_GROUP_COLUMNS} from public.class_groups where id = $1`,
      [id],
    );
  }

  async listGradeCodes(classGroupId: string): Promise<string[]> {
    const rows = await this.sp.selectMany<{ grade_code: string }>(
      'select grade_code from public.class_group_grades where class_group_id = $1 order by grade_code',
      [classGroupId],
    );
    return rows.map((row) => row.grade_code);
  }

  async listGradeCodesForMany(classGroupIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (classGroupIds.length === 0) return map;
    const rows = await this.sp.selectMany<{ class_group_id: string; grade_code: string }>(
      'select class_group_id, grade_code from public.class_group_grades where class_group_id = any($1) order by grade_code',
      [classGroupIds],
    );
    for (const row of rows) {
      const list = map.get(row.class_group_id) ?? [];
      list.push(row.grade_code);
      map.set(row.class_group_id, list);
    }
    return map;
  }

  /**
   * Mirrors `private.check_class_tutor_competent()`'s own query — a
   * synchronous pre-check so create/update fails before any row is written
   * (`03-endpoints-and-business-rules.md`: "this moves from an after-the-fact
   * deferred trigger to a pre-check, which is strictly safer"). The deferred
   * trigger still fires at COMMIT as a backstop. Returns the grade codes the
   * tutor is NOT recorded as competent for; empty means fully competent.
   */
  async findMissingCompetencies(input: {
    tutorId: string;
    subjectCode: string;
    languageCode: string;
    gradeCodes: string[];
  }): Promise<string[]> {
    const rows = await this.sp.selectMany<{ grade_code: string }>(
      `select g.grade_code
       from unnest($1::text[]) as g(grade_code)
       where not exists (
         select 1 from public.tutor_competencies tc
         join public.tutor_competency_media tm on tm.competency_id = tc.id
         where tc.tutor_id = $2 and tc.subject_code = $3
           and tc.grade_code = g.grade_code and tm.language_code = $4
       )`,
      [input.gradeCodes, input.tutorId, input.subjectCode, input.languageCode],
    );
    return rows.map((row) => row.grade_code);
  }

  async insertClassGroup(input: {
    name: string;
    subjectCode: string;
    languageCode: string;
    tutorId: string;
    termId: string;
    deliveryMode: string;
    roomId?: string;
    capacity: number;
  }): Promise<ClassGroupRow> {
    const result = await this.sp.executeRaw<ClassGroupRow>(
      `insert into public.class_groups (name, subject_code, language_code, tutor_id, term_id, delivery_mode, room_id, capacity)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning ${CLASS_GROUP_COLUMNS}`,
      [
        input.name,
        input.subjectCode,
        input.languageCode,
        input.tutorId,
        input.termId,
        input.deliveryMode,
        input.roomId ?? null,
        input.capacity,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  async insertClassGroupGrades(classGroupId: string, gradeCodes: string[]): Promise<void> {
    for (const gradeCode of gradeCodes) {
      await this.sp.executeRaw(
        'insert into public.class_group_grades (class_group_id, grade_code) values ($1, $2)',
        [classGroupId, gradeCode],
      );
    }
  }

  async clearClassGroupGrades(classGroupId: string): Promise<void> {
    await this.sp.executeRaw(
      'delete from public.class_group_grades where class_group_id = $1',
      [classGroupId],
    );
  }

  async updateClassGroup(id: string, patch: ClassGroupPatch): Promise<ClassGroupRow | undefined> {
    const values: unknown[] = [];
    const sets: string[] = [];
    const push = (column: string, value: unknown): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (patch.name !== undefined) push('name', patch.name);
    if (patch.subjectCode !== undefined) push('subject_code', patch.subjectCode);
    if (patch.languageCode !== undefined) push('language_code', patch.languageCode);
    if (patch.tutorId !== undefined) push('tutor_id', patch.tutorId);
    if (patch.termId !== undefined) push('term_id', patch.termId);
    if (patch.deliveryMode !== undefined) push('delivery_mode', patch.deliveryMode);
    if (patch.roomId !== undefined) push('room_id', patch.roomId);
    if (patch.capacity !== undefined) push('capacity', patch.capacity);
    if (patch.isActive !== undefined) push('is_active', patch.isActive);
    if (sets.length === 0) return this.getClassGroupById(id);

    values.push(id);
    const result = await this.sp.executeRaw<ClassGroupRow>(
      `update public.class_groups set ${sets.join(', ')} where id = $${values.length} returning ${CLASS_GROUP_COLUMNS}`,
      values,
    );
    return result.rows[0];
  }

  async addSchedule(
    classGroupId: string,
    schedule: { dayOfWeek: number; startsAtTime: string; endsAtTime: string },
  ): Promise<ClassScheduleRow> {
    const result = await this.sp.executeRaw<ClassScheduleRow>(
      `insert into public.class_schedules (class_group_id, day_of_week, starts_at_time, ends_at_time)
       values ($1, $2, $3, $4)
       returning ${CLASS_SCHEDULE_COLUMNS}`,
      [classGroupId, schedule.dayOfWeek, schedule.startsAtTime, schedule.endsAtTime],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  async removeSchedule(classGroupId: string, scheduleId: string): Promise<number> {
    const result = await this.sp.executeRaw(
      'delete from public.class_schedules where id = $1 and class_group_id = $2',
      [scheduleId, classGroupId],
    );
    return result.rowCount;
  }

  /** Calls the existing `public.generate_class_sessions(p_class_group_id)` function — idempotent, admin-gated inside the function too. */
  async generateSessions(classGroupId: string): Promise<number> {
    const row = await this.sp.queryOne<{ generate_class_sessions: number }>(
      'public.generate_class_sessions',
      [p.uuid('p_class_group_id', classGroupId)],
    );
    return row?.generate_class_sessions ?? 0;
  }

  async listSessions(
    filter: ListSessionsFilter,
  ): Promise<{ rows: ClassSessionRow[]; totalCount: number }> {
    const values: unknown[] = [];
    const clauses: string[] = [];
    if (filter.classGroupId) {
      values.push(filter.classGroupId);
      clauses.push(`class_group_id = $${values.length}`);
    }
    if (filter.fromDate) {
      values.push(filter.fromDate);
      clauses.push(`session_date >= $${values.length}`);
    }
    if (filter.toDate) {
      values.push(filter.toDate);
      clauses.push(`session_date <= $${values.length}`);
    }
    if (filter.status) {
      values.push(filter.status);
      clauses.push(`status = $${values.length}`);
    }
    const where = clauses.length > 0 ? `where ${clauses.join(' and ')}` : '';
    values.push(filter.pageSize, (filter.page - 1) * filter.pageSize);

    const result = await this.sp.executeRaw<ClassSessionRow & { total_count: string }>(
      `select ${CLASS_SESSION_COLUMNS}, count(*) over() as total_count
       from public.class_sessions
       ${where}
       order by session_date, starts_at
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    const firstRow = result.rows[0];
    return { rows: result.rows, totalCount: firstRow ? Number(firstRow.total_count) : 0 };
  }

  getSessionById(id: string): Promise<ClassSessionRow | undefined> {
    return this.sp.selectOne<ClassSessionRow>(
      `select ${CLASS_SESSION_COLUMNS} from public.class_sessions where id = $1`,
      [id],
    );
  }

  async updateSessionStatus(
    id: string,
    patch: SessionPatch,
  ): Promise<ClassSessionRow | undefined> {
    const values: unknown[] = [];
    const sets: string[] = [];
    const push = (column: string, value: unknown): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (patch.status !== undefined) push('status', patch.status);
    if (patch.notes !== undefined) push('notes', patch.notes);
    if (patch.meetingUrl !== undefined) push('meeting_url', patch.meetingUrl);
    if (sets.length === 0) return this.getSessionById(id);

    values.push(id);
    const result = await this.sp.executeRaw<ClassSessionRow>(
      `update public.class_sessions set ${sets.join(', ')} where id = $${values.length} returning ${CLASS_SESSION_COLUMNS}`,
      values,
    );
    return result.rows[0];
  }

  listPlacements(classGroupId: string): Promise<ClassEnrolmentRow[]> {
    return this.sp.selectMany<ClassEnrolmentRow>(
      `select ${CLASS_ENROLMENT_COLUMNS} from public.class_enrolments where class_group_id = $1 order by joined_on`,
      [classGroupId],
    );
  }

  /** The capacity-under-lock trigger and the "one active placement per learner" filtered unique index both fire on this INSERT — never pre-checked here, per Phase 0 §6. */
  async placeLearner(
    classGroupId: string,
    learnerId: string,
    enrolmentId: string,
  ): Promise<ClassEnrolmentRow> {
    const result = await this.sp.executeRaw<ClassEnrolmentRow>(
      `insert into public.class_enrolments (class_group_id, learner_id, enrolment_id)
       values ($1, $2, $3)
       returning ${CLASS_ENROLMENT_COLUMNS}`,
      [classGroupId, learnerId, enrolmentId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  async withdrawPlacement(
    classGroupId: string,
    placementId: string,
  ): Promise<ClassEnrolmentRow | undefined> {
    const result = await this.sp.executeRaw<ClassEnrolmentRow>(
      `update public.class_enrolments set left_on = current_date
       where id = $1 and class_group_id = $2 and left_on is null
       returning ${CLASS_ENROLMENT_COLUMNS}`,
      [placementId, classGroupId],
    );
    return result.rows[0];
  }
}
