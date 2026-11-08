import type { SubmitEnrolmentPayload } from './enrolment.repository.js';
import type { EnrolmentSubjectDto } from './dto/update-enrolment-subjects.dto.js';
import type { SubmitEnrolmentDto } from './dto/submit-enrolment.dto.js';
import type { EnrolmentDto } from './dto/enrolment.dto.js';
import type { EnrolmentRow, EnrolmentSubjectRow } from './rows/enrolment.row.js';

export class EnrolmentMapper {
  /**
   * The DTO→jsonb assembly `08-phase3b-...md` task 2 singles out as the
   * place a silently-dropped field would hide — kept as one pure function,
   * unit-tested exhaustively, so the controller/Manager wiring is trivial
   * and this mapping is checked in complete isolation from the database.
   */
  static toSubmitPayload(dto: SubmitEnrolmentDto): SubmitEnrolmentPayload {
    return {
      learner: {
        full_name: dto.learner.fullName,
        date_of_birth: dto.learner.dateOfBirth,
        grade_code: dto.learner.gradeCode,
        school_name: dto.learner.schoolName,
        home_language_code: dto.learner.homeLanguageCode,
        relationship: dto.learner.relationship,
      },
      packageCode: dto.packageCode,
      subjects: (dto.subjects ?? []).map((subject) => ({
        subject_code: subject.subjectCode,
        preferred_language_code: subject.preferredLanguageCode,
      })),
      emergencyContacts: dto.emergencyContacts.map((contact) => ({
        full_name: contact.fullName,
        relationship: contact.relationship,
        phone: contact.phone,
        priority: contact.priority,
      })),
      collectors: (dto.collectors ?? []).map((collector) => ({
        full_name: collector.fullName,
        relationship: collector.relationship,
        phone: collector.phone,
        id_number_last4: collector.idNumberLast4,
      })),
      consents: dto.consents.map((consent) => ({
        consent_type_code: consent.consentTypeCode,
        granted: consent.granted,
      })),
      policyVersion: dto.policyVersion,
      preferredTutorId: dto.preferredTutorId,
    };
  }

  static toDto(row: EnrolmentRow): EnrolmentDto {
    return {
      id: row.id,
      learnerId: row.learner_id,
      packageCode: row.package_code,
      status: row.status,
      preferredTutorId: row.preferred_tutor_id ?? undefined,
      assignedTutorId: row.assigned_tutor_id ?? undefined,
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      source: row.source,
    };
  }

  static subjectToDto(row: EnrolmentSubjectRow): EnrolmentSubjectDto {
    return {
      subjectCode: row.subject_code,
      preferredLanguageCode: row.preferred_language_code ?? undefined,
    };
  }
}
