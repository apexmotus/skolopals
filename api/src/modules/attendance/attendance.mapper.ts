import type { AttendanceRecordDto } from './dto/attendance-record.dto';
import type { SessionCheckInDto } from './dto/session-check-in.dto';
import type { AttendanceRecordRow } from './rows/attendance-record.row';
import type { SessionCheckInRow } from './rows/session-check-in.row';

export class AttendanceMapper {
  static recordToDto(row: AttendanceRecordRow): AttendanceRecordDto {
    return {
      id: row.id,
      classSessionId: row.class_session_id,
      learnerId: row.learner_id,
      status: row.status,
      markedBy: row.marked_by ?? undefined,
      markedAt: row.marked_at,
      note: row.note,
    };
  }

  static checkInToDto(row: SessionCheckInRow): SessionCheckInDto {
    return {
      id: row.id,
      classSessionId: row.class_session_id,
      learnerId: row.learner_id,
      arrivedAt: row.arrived_at,
      signedInBy: row.signed_in_by ?? undefined,
      departedAt: row.departed_at ?? undefined,
      collectedBy: row.collected_by ?? undefined,
      signedOutBy: row.signed_out_by ?? undefined,
      note: row.note,
    };
  }
}
