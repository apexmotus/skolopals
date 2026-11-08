import type { AchievementLevelDto } from './dto/achievement-level.dto.js';
import type { AssessmentDomainDto } from './dto/assessment-domain.dto.js';
import type { AssessmentTypeDto } from './dto/assessment-type.dto.js';
import type { ConsentTypeDto } from './dto/consent-type.dto.js';
import type { DataRetentionPolicyDto } from './dto/data-retention-policy.dto.js';
import type { GradeDto } from './dto/grade.dto.js';
import type { LanguageDto } from './dto/language.dto.js';
import type { OperatingHourDto } from './dto/operating-hour.dto.js';
import type { RoomDto } from './dto/room.dto.js';
import type { SchoolPhaseDto } from './dto/school-phase.dto.js';
import type { SubjectOfferingDto } from './dto/subject-offering.dto.js';
import type { SubjectDto } from './dto/subject.dto.js';
import type { TermDto } from './dto/term.dto.js';
import type { AchievementLevelRow } from './rows/achievement-level.row.js';
import type { AssessmentDomainRow } from './rows/assessment-domain.row.js';
import type { AssessmentTypeRow } from './rows/assessment-type.row.js';
import type { ConsentTypeRow } from './rows/consent-type.row.js';
import type { DataRetentionPolicyRow } from './rows/data-retention-policy.row.js';
import type { GradeRow } from './rows/grade.row.js';
import type { LanguageRow } from './rows/language.row.js';
import type { OperatingHourRow } from './rows/operating-hour.row.js';
import type { RoomRow } from './rows/room.row.js';
import type { SchoolPhaseRow } from './rows/school-phase.row.js';
import type { SubjectOfferingRow } from './rows/subject-offering.row.js';
import type { SubjectRow } from './rows/subject.row.js';
import type { TermRow } from './rows/term.row.js';

export class ReferenceMapper {
  static schoolPhaseToDto(row: SchoolPhaseRow): SchoolPhaseDto {
    return { code: row.code, name: row.name, sortOrder: row.sort_order };
  }

  static gradeToDto(row: GradeRow): GradeDto {
    return {
      code: row.code,
      name: row.name,
      phaseCode: row.phase_code,
      sortOrder: row.sort_order,
    };
  }

  static subjectToDto(row: SubjectRow): SubjectDto {
    return {
      code: row.code,
      name: row.name,
      description: row.description,
      isLanguage: row.is_language,
      sortOrder: row.sort_order,
    };
  }

  static subjectOfferingToDto(row: SubjectOfferingRow): SubjectOfferingDto {
    return { subjectCode: row.subject_code, gradeCode: row.grade_code };
  }

  static languageToDto(row: LanguageRow): LanguageDto {
    return { code: row.code, name: row.name, sortOrder: row.sort_order };
  }

  static achievementLevelToDto(row: AchievementLevelRow): AchievementLevelDto {
    return {
      code: row.code,
      label: row.label,
      description: row.description,
      minPercent: row.min_percent,
      maxPercent: row.max_percent,
    };
  }

  static assessmentTypeToDto(row: AssessmentTypeRow): AssessmentTypeDto {
    return {
      code: row.code,
      name: row.name,
      description: row.description,
      sortOrder: row.sort_order,
    };
  }

  static consentTypeToDto(row: ConsentTypeRow): ConsentTypeDto {
    return {
      code: row.code,
      name: row.name,
      description: row.description,
      statuteRef: row.statute_ref,
      isRequired: row.is_required,
      sortOrder: row.sort_order,
    };
  }

  static dataRetentionPolicyToDto(
    row: DataRetentionPolicyRow,
  ): DataRetentionPolicyDto {
    return {
      recordClass: row.record_class,
      description: row.description,
      retentionMonths: row.retention_months,
      basis: row.basis,
    };
  }

  static assessmentDomainToDto(row: AssessmentDomainRow): AssessmentDomainDto {
    return {
      code: row.code,
      name: row.name,
      description: row.description,
      sortOrder: row.sort_order,
    };
  }

  static termToDto(row: TermRow): TermDto {
    return {
      id: row.id,
      year: row.year,
      termNumber: row.term_number,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
    };
  }

  static operatingHourToDto(row: OperatingHourRow): OperatingHourDto {
    return {
      dayOfWeek: row.day_of_week,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      purpose: row.purpose,
    };
  }

  static roomToDto(row: RoomRow): RoomDto {
    return {
      id: row.id,
      name: row.name,
      capacity: row.capacity,
      isActive: row.is_active,
    };
  }
}
