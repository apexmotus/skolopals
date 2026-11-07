import type { ClassGroupDto } from './dto/class-group.dto';
import type { ClassScheduleDto } from './dto/class-schedule.dto';
import type { ClassSessionDto } from './dto/class-session.dto';
import type { ClassEnrolmentDto } from './dto/class-enrolment.dto';
import type { PublicTimetableEntryDto } from './dto/public-timetable.dto';
import type { ClassGroupRow } from './rows/class-group.row';
import type { ClassScheduleRow } from './rows/class-schedule.row';
import type { ClassSessionRow } from './rows/class-session.row';
import type { ClassEnrolmentRow } from './rows/class-enrolment.row';
import type { PublicTimetableRow } from './rows/public-timetable.row';

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
