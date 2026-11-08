import type { ClassGroupDto } from './dto/class-group.dto.js';
import type { ClassScheduleDto } from './dto/class-schedule.dto.js';
import type { ClassSessionDto } from './dto/class-session.dto.js';
import type { ClassEnrolmentDto } from './dto/class-enrolment.dto.js';
import type { PublicTimetableEntryDto } from './dto/public-timetable.dto.js';
import type { ClassGroupRow } from './rows/class-group.row.js';
import type { ClassScheduleRow } from './rows/class-schedule.row.js';
import type { ClassSessionRow } from './rows/class-session.row.js';
import type { ClassEnrolmentRow } from './rows/class-enrolment.row.js';
import type { PublicTimetableRow } from './rows/public-timetable.row.js';

export class TimetableMapper {
  static publicEntryToDto(row: PublicTimetableRow): PublicTimetableEntryDto {
    return {
      classGroupId: row.class_group_id,
      className: row.class_name,
      subject: row.subject,
      language: row.language,
      deliveryMode: row.delivery_mode,
      capacity: row.capacity,
      dayOfWeek: row.day_of_week,
      startsAtTime: row.starts_at_time,
      endsAtTime: row.ends_at_time,
      tutorSlug: row.tutor_slug,
      tutorName: row.tutor_name,
    };
  }

  static classGroupToDto(row: ClassGroupRow, gradeCodes: string[]): ClassGroupDto {
    return {
      id: row.id,
      name: row.name,
      subjectCode: row.subject_code,
      languageCode: row.language_code,
      tutorId: row.tutor_id,
      termId: row.term_id,
      deliveryMode: row.delivery_mode,
      roomId: row.room_id ?? undefined,
      capacity: row.capacity,
      isActive: row.is_active,
      gradeCodes,
    };
  }

  static scheduleToDto(row: ClassScheduleRow): ClassScheduleDto {
    return {
      id: row.id,
      classGroupId: row.class_group_id,
      dayOfWeek: row.day_of_week,
      startsAtTime: row.starts_at_time,
      endsAtTime: row.ends_at_time,
    };
  }

  static sessionToDto(row: ClassSessionRow): ClassSessionDto {
    return {
      id: row.id,
      classGroupId: row.class_group_id,
      scheduleId: row.schedule_id ?? undefined,
      sessionDate: row.session_date,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      tutorId: row.tutor_id ?? undefined,
      meetingUrl: row.meeting_url ?? undefined,
      notes: row.notes,
    };
  }

  static placementToDto(row: ClassEnrolmentRow): ClassEnrolmentDto {
    return {
      id: row.id,
      classGroupId: row.class_group_id,
      learnerId: row.learner_id,
      enrolmentId: row.enrolment_id,
      joinedOn: row.joined_on,
      leftOn: row.left_on ?? undefined,
    };
  }
}
