import { Injectable } from '@nestjs/common';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { ProgrammeAttendanceRow } from './rows/programme-attendance.row.js';
import type { ProgrammeEnrolmentRow } from './rows/programme-enrolment.row.js';
import type { ProgrammeSessionRow } from './rows/programme-session.row.js';
import type { ProgrammeRow } from './rows/programme.row.js';

const PROGRAMME_COLUMNS =
  'id, name, description, programme_type, starts_on, ends_on, capacity, price_cents, delivery_mode, room_id, is_published, created_at';
const PROGRAMME_SESSION_COLUMNS =
  'id, programme_id, session_date, starts_at, ends_at, tutor_id, status, meeting_url, notes';
const PROGRAMME_ENROLMENT_COLUMNS = 'id, programme_id, learner_id, status, booked_at';
const PROGRAMME_ATTENDANCE_COLUMNS =
  'id, programme_session_id, learner_id, status, marked_by, marked_at, note';

interface ProgrammePatch {
  name?: string;
  description?: string;
  programmeType?: string;
  startsOn?: string;
  endsOn?: string;
  capacity?: number;
  priceCents?: number;
  deliveryMode?: string;
  roomId?: string | null;
  isPublished?: boolean;
}

/**
 * Plain table reads/writes, same convention as `timetable`/`attendance` —
 * confirmed by grepping `db/migrations/*.sql` for
 * `create or replace function public\.` that none of `programmes`/
 * `programme_sessions`/`programme_enrolments`/`programme_attendance_records`
 * have a dedicated function. `programmes`' own RLS policy
 * (`is_published or is_admin()`) does the admin-sees-unpublished-too
 * branching by itself, same as `class_groups` in `timetable` — no
 * `packages`-style Manager branch needed for `listProgrammes`/
 * `getProgrammeById`. The capacity-under-lock trigger
 * (`check_programme_capacity`, already fixed to `for update` — Phase 0 §4)
 * fires on `bookProgramme`'s INSERT and is never pre-checked here.
 */
@Injectable()
export class ProgrammesRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  listProgrammes(): Promise<ProgrammeRow[]> {
    return this.sp.selectMany<ProgrammeRow>(
      `select ${PROGRAMME_COLUMNS} from public.programmes order by starts_on`,
    );
  }

  getProgrammeById(id: string): Promise<ProgrammeRow | undefined> {
    return this.sp.selectOne<ProgrammeRow>(
      `select ${PROGRAMME_COLUMNS} from public.programmes where id = $1`,
      [id],
    );
  }

  async createProgramme(input: {
    name: string;
    description?: string;
    programmeType: string;
    startsOn: string;
    endsOn: string;
    capacity: number;
    priceCents: number;
    deliveryMode: string;
    roomId?: string;
  }): Promise<ProgrammeRow> {
    const result = await this.sp.executeRaw<ProgrammeRow>(
      `insert into public.programmes
         (name, description, programme_type, starts_on, ends_on, capacity, price_cents, delivery_mode, room_id)
       values ($1, coalesce($2, ''), $3, $4, $5, $6, $7, $8, $9)
       returning ${PROGRAMME_COLUMNS}`,
      [
        input.name,
        input.description ?? null,
        input.programmeType,
        input.startsOn,
        input.endsOn,
        input.capacity,
        input.priceCents,
        input.deliveryMode,
        input.roomId ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  async updateProgramme(id: string, patch: ProgrammePatch): Promise<ProgrammeRow | undefined> {
    const values: unknown[] = [];
    const sets: string[] = [];
    const push = (column: string, value: unknown): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (patch.name !== undefined) push('name', patch.name);
    if (patch.description !== undefined) push('description', patch.description);
    if (patch.programmeType !== undefined) push('programme_type', patch.programmeType);
    if (patch.startsOn !== undefined) push('starts_on', patch.startsOn);
    if (patch.endsOn !== undefined) push('ends_on', patch.endsOn);
    if (patch.capacity !== undefined) push('capacity', patch.capacity);
    if (patch.priceCents !== undefined) push('price_cents', patch.priceCents);
    if (patch.deliveryMode !== undefined) push('delivery_mode', patch.deliveryMode);
    if (patch.roomId !== undefined) push('room_id', patch.roomId);
    if (patch.isPublished !== undefined) push('is_published', patch.isPublished);
    if (sets.length === 0) return this.getProgrammeById(id);

    values.push(id);
    const result = await this.sp.executeRaw<ProgrammeRow>(
      `update public.programmes set ${sets.join(', ')} where id = $${values.length} returning ${PROGRAMME_COLUMNS}`,
      values,
    );
    return result.rows[0];
  }

  async addSession(
    programmeId: string,
    session: {
      sessionDate: string;
      startsAt: string;
      endsAt: string;
      tutorId?: string;
      meetingUrl?: string;
      notes?: string;
    },
  ): Promise<ProgrammeSessionRow> {
    const result = await this.sp.executeRaw<ProgrammeSessionRow>(
      `insert into public.programme_sessions (programme_id, session_date, starts_at, ends_at, tutor_id, meeting_url, notes)
       values ($1, $2, $3, $4, $5, $6, coalesce($7, ''))
       returning ${PROGRAMME_SESSION_COLUMNS}`,
      [
        programmeId,
        session.sessionDate,
        session.startsAt,
        session.endsAt,
        session.tutorId ?? null,
        session.meetingUrl ?? null,
        session.notes ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  listSessions(programmeId: string): Promise<ProgrammeSessionRow[]> {
    return this.sp.selectMany<ProgrammeSessionRow>(
      `select ${PROGRAMME_SESSION_COLUMNS} from public.programme_sessions where programme_id = $1 order by session_date, starts_at`,
      [programmeId],
    );
  }

  listBookings(programmeId: string): Promise<ProgrammeEnrolmentRow[]> {
    return this.sp.selectMany<ProgrammeEnrolmentRow>(
      `select ${PROGRAMME_ENROLMENT_COLUMNS} from public.programme_enrolments where programme_id = $1 order by booked_at`,
      [programmeId],
    );
  }

  /** The capacity-under-lock trigger fires on this INSERT — never pre-checked here, per Phase 0 §6 (the concurrency test this module exists to prove). */
  async bookProgramme(programmeId: string, learnerId: string): Promise<ProgrammeEnrolmentRow> {
    const result = await this.sp.executeRaw<ProgrammeEnrolmentRow>(
      `insert into public.programme_enrolments (programme_id, learner_id)
       values ($1, $2)
       returning ${PROGRAMME_ENROLMENT_COLUMNS}`,
      [programmeId, learnerId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  async cancelBooking(
    programmeId: string,
    enrolmentId: string,
  ): Promise<ProgrammeEnrolmentRow | undefined> {
    const result = await this.sp.executeRaw<ProgrammeEnrolmentRow>(
      `update public.programme_enrolments set status = 'cancelled'
       where id = $1 and programme_id = $2 and status = 'booked'
       returning ${PROGRAMME_ENROLMENT_COLUMNS}`,
      [enrolmentId, programmeId],
    );
    return result.rows[0];
  }

  listAttendance(programmeSessionId: string): Promise<ProgrammeAttendanceRow[]> {
    return this.sp.selectMany<ProgrammeAttendanceRow>(
      `select ${PROGRAMME_ATTENDANCE_COLUMNS} from public.programme_attendance_records where programme_session_id = $1 order by marked_at`,
      [programmeSessionId],
    );
  }

  async markAttendance(input: {
    programmeSessionId: string;
    learnerId: string;
    status: string;
    markedBy: string;
    note?: string;
  }): Promise<ProgrammeAttendanceRow> {
    const result = await this.sp.executeRaw<ProgrammeAttendanceRow>(
      `insert into public.programme_attendance_records (programme_session_id, learner_id, status, marked_by, note)
       values ($1, $2, $3, $4, coalesce($5, ''))
       returning ${PROGRAMME_ATTENDANCE_COLUMNS}`,
      [input.programmeSessionId, input.learnerId, input.status, input.markedBy, input.note ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }
}
