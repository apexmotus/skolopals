import type { ConsentDto } from './dto/consent.dto';
import type { RetentionDueDto, RetentionLogDto } from './dto/retention.dto';
import type { ConsentRow } from './rows/consent.row';
import type { RetentionDueRow, RetentionLogRow } from './rows/retention.row';

export class ConsentMapper {
  static toDto(row: ConsentRow): ConsentDto {
    return {
      id: row.id,
      consentTypeCode: row.consent_type_code,
      guardianId: row.guardian_id,
      learnerId: row.learner_id ?? undefined,
      granted: row.granted,
      grantedAt: row.granted_at,
      withdrawnAt: row.withdrawn_at ?? undefined,
      policyVersion: row.policy_version,
    };
  }

  static retentionDueToDto(row: RetentionDueRow): RetentionDueDto {
    return {
      recordClass: row.record_class,
      subjectId: row.subject_id,
      subjectLabel: row.subject_label,
      leftOn: row.left_on,
      retentionMonths: row.retention_months,
      dueOn: row.due_on,
    };
  }

  static retentionLogToDto(row: RetentionLogRow): RetentionLogDto {
    return {
      id: row.id,
      recordClass: row.record_class,
      subjectId: row.subject_id,
      subjectLabel: row.subject_label,
      action: row.action,
      performedAt: row.performed_at,
      confirmedBy: row.confirmed_by ?? undefined,
      note: row.note,
    };
  }
}
