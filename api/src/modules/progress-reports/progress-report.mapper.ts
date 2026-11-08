import type {
  ProgressReportDto,
  ProgressReportSubjectDto,
  ReportAcknowledgementDto,
  SaveProgressReportDto,
} from './dto/progress-report.dto.js';
import type {
  ProgressReportRow,
  ProgressReportSubjectRow,
  ReportAcknowledgementRow,
} from './rows/progress-report.row.js';

export class ProgressReportMapper {
  /** Pure DTO→jsonb assembly, unit-tested in isolation, same reasoning as `EnrolmentMapper.toSubmitPayload`. */
  static toSubjectsPayload(
    dto: SaveProgressReportDto,
  ): Record<string, unknown>[] {
    return dto.subjects.map((subject) => ({
      subject_code: subject.subjectCode,
      achievement_level_code: subject.achievementLevelCode,
      strengths: subject.strengths ?? '',
      areas_for_improvement: subject.areasForImprovement ?? '',
      recommended_intervention: subject.recommendedIntervention ?? '',
    }));
  }

  static subjectToDto(row: ProgressReportSubjectRow): ProgressReportSubjectDto {
    return {
      subjectCode: row.subject_code,
      achievementLevelCode: row.achievement_level_code ?? undefined,
      strengths: row.strengths,
      areasForImprovement: row.areas_for_improvement,
      recommendedIntervention: row.recommended_intervention,
    };
  }

  /** `row.acknowledged_at` is already an ISO string — see `ReportAcknowledgementRow`'s doc comment for why. */
  static acknowledgementToDto(
    row: ReportAcknowledgementRow,
  ): ReportAcknowledgementDto {
    return {
      guardianId: row.guardian_id,
      acknowledgedAt: row.acknowledged_at,
      comment: row.comment,
    };
  }

  static toDto(row: ProgressReportRow): ProgressReportDto {
    return {
      id: row.id,
      learnerId: row.learner_id,
      termId: row.term_id,
      tutorId: row.tutor_id ?? undefined,
      summary: row.summary,
      attendanceNote: row.attendance_note,
      issuedOn: row.issued_on ?? undefined,
      publishedAt: row.published_at?.toISOString(),
      subjects: row.subjects.map((subject) =>
        ProgressReportMapper.subjectToDto(subject),
      ),
      acknowledgements: row.acknowledgements.map((ack) =>
        ProgressReportMapper.acknowledgementToDto(ack),
      ),
    };
  }
}
