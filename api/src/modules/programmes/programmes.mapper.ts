import type { ProgrammeAttendanceDto } from './dto/programme-attendance.dto';
import type { ProgrammeEnrolmentDto } from './dto/programme-enrolment.dto';
import type { ProgrammeSessionDto } from './dto/programme-session.dto';
import type { ProgrammeDto } from './dto/programme.dto';
import type { ProgrammeAttendanceRow } from './rows/programme-attendance.row';
import type { ProgrammeEnrolmentRow } from './rows/programme-enrolment.row';
import type { ProgrammeSessionRow } from './rows/programme-session.row';
import type { ProgrammeRow } from './rows/programme.row';

export class ProgrammesMapper {
  static toDto(row: ProgrammeRow): ProgrammeDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      programmeType: row.programme_type,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      capacity: row.capacity,
      priceCents: row.price_cents,
      deliveryMode: row.delivery_mode,
      roomId: row.room_id ?? undefined,
      isPublished: row.is_published,
    };
  }

  static sessionToDto(row: ProgrammeSessionRow): ProgrammeSessionDto {
    return {
      id: row.id,
      programmeId: row.programme_id,
      sessionDate: row.session_date,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      tutorId: row.tutor_id ?? undefined,
      status: row.status,
      meetingUrl: row.meeting_url ?? undefined,
      notes: row.notes,
    };
  }

  static enrolmentToDto(row: ProgrammeEnrolmentRow): ProgrammeEnrolmentDto {
    return {
      id: row.id,
      programmeId: row.programme_id,
      learnerId: row.learner_id,
      status: row.status,
      bookedAt: row.booked_at,
    };
  }

  static attendanceToDto(row: ProgrammeAttendanceRow): ProgrammeAttendanceDto {
    return {
      id: row.id,
      programmeSessionId: row.programme_session_id,
      learnerId: row.learner_id,
      status: row.status,
      markedBy: row.marked_by ?? undefined,
      markedAt: row.marked_at,
      note: row.note,
    };
  }
}
