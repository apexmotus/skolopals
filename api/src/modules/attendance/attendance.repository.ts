import { Injectable } from '@nestjs/common';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { AttendanceRecordRow } from './rows/attendance-record.row.js';
import type { SessionCheckInRow } from './rows/session-check-in.row.js';

const ATTENDANCE_COLUMNS = 'id, class_session_id, learner_id, status, marked_by, marked_at, note';
const CHECK_IN_COLUMNS =
  'id, class_session_id, learner_id, arrived_at, signed_in_by, departed_at, collected_by, signed_out_by, note';

interface AttendancePatch {
  status?: string;
  note?: string;
}

/**
 * Plain table reads/writes, same convention as `timetable` — confirmed by
 * grepping `db/migrations/*.sql` for `create or replace function public\.`
 * that neither `attendance_records` nor `session_check_ins` have a dedicated
 * function. Both rules (tutor-marks-own-session, collector-must-be-
 * authorised) are enforced by existing RLS policies/triggers, not
 * pre-checked here — unlike `timetable`'s tutor-competency check, neither
 * business rule is flagged in `03-endpoints-and-business-rules.md` as
 * needing a synchronous pre-check, and both underlying triggers/policies are
 * immediate (not deferred), so the rejection already surfaces on the same
 * call via `SqlErrorMapper`.
 */
@Injectable()
export class AttendanceRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  listAttendance(classSessionId: string): Promise<AttendanceRecordRow[]> {
    return this.sp.selectMany<AttendanceRecordRow>(
      `select ${ATTENDANCE_COLUMNS} from public.attendance_records where class_session_id = $1 order by marked_at`,
      [classSessionId],
    );
  }

  getAttendanceById(id: string): Promise<AttendanceRecordRow | undefined> {
    return this.sp.selectOne<AttendanceRecordRow>(
      `select ${ATTENDANCE_COLUMNS} from public.attendance_records where id = $1`,
      [id],
    );
  }

  async markAttendance(input: {
    classSessionId: string;
    learnerId: string;
    status: string;
    markedBy: string;
    note?: string;
  }): Promise<AttendanceRecordRow> {
    const result = await this.sp.executeRaw<AttendanceRecordRow>(
      `insert into public.attendance_records (class_session_id, learner_id, status, marked_by, note)
       values ($1, $2, $3, $4, coalesce($5, ''))
       returning ${ATTENDANCE_COLUMNS}`,
      [input.classSessionId, input.learnerId, input.status, input.markedBy, input.note ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  /** Also updates `marked_by`/`marked_at` to the corrector — this table has no separate "corrected by" pair. */
  async correctAttendance(
    classSessionId: string,
    id: string,
    correctedBy: string,
    patch: AttendancePatch,
  ): Promise<AttendanceRecordRow | undefined> {
    const values: unknown[] = [correctedBy];
    const sets: string[] = ['marked_by = $1', 'marked_at = now()'];
    const push = (column: string, value: unknown): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (patch.status !== undefined) push('status', patch.status);
    if (patch.note !== undefined) push('note', patch.note);

    values.push(id, classSessionId);
    const result = await this.sp.executeRaw<AttendanceRecordRow>(
      `update public.attendance_records set ${sets.join(', ')}
       where id = $${values.length - 1} and class_session_id = $${values.length}
       returning ${ATTENDANCE_COLUMNS}`,
      values,
    );
    return result.rows[0];
  }

  listCheckIns(classSessionId: string): Promise<SessionCheckInRow[]> {
    return this.sp.selectMany<SessionCheckInRow>(
      `select ${CHECK_IN_COLUMNS} from public.session_check_ins where class_session_id = $1 order by arrived_at`,
      [classSessionId],
    );
  }

  getCheckInById(id: string): Promise<SessionCheckInRow | undefined> {
    return this.sp.selectOne<SessionCheckInRow>(
      `select ${CHECK_IN_COLUMNS} from public.session_check_ins where id = $1`,
      [id],
    );
  }

  async recordCheckIn(input: {
    classSessionId: string;
    learnerId: string;
    signedInBy: string;
    note?: string;
  }): Promise<SessionCheckInRow> {
    const result = await this.sp.executeRaw<SessionCheckInRow>(
      `insert into public.session_check_ins (class_session_id, learner_id, signed_in_by, note)
       values ($1, $2, $3, coalesce($4, ''))
       returning ${CHECK_IN_COLUMNS}`,
      [input.classSessionId, input.learnerId, input.signedInBy, input.note ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  /** `departed_at` has no column default (it only applies on INSERT), so it's set to `now()` here explicitly. The `check_collector_authorised` trigger fires on this UPDATE. */
  async signOutCheckIn(
    classSessionId: string,
    id: string,
    input: { collectedBy: string; signedOutBy: string; note?: string },
  ): Promise<SessionCheckInRow | undefined> {
    const values: unknown[] = [input.collectedBy, input.signedOutBy];
    const sets = ['departed_at = now()', 'collected_by = $1', 'signed_out_by = $2'];
    if (input.note !== undefined) {
      values.push(input.note);
      sets.push(`note = $${values.length}`);
    }
    values.push(id, classSessionId);
    const result = await this.sp.executeRaw<SessionCheckInRow>(
      `update public.session_check_ins set ${sets.join(', ')}
       where id = $${values.length - 1} and class_session_id = $${values.length}
       returning ${CHECK_IN_COLUMNS}`,
      values,
    );
    return result.rows[0];
  }
}
