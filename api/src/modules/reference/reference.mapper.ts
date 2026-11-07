import type { AchievementLevelDto } from './dto/achievement-level.dto';
import type { AssessmentDomainDto } from './dto/assessment-domain.dto';
import type { AssessmentTypeDto } from './dto/assessment-type.dto';
import type { ConsentTypeDto } from './dto/consent-type.dto';
import type { GradeDto } from './dto/grade.dto';
import type { LanguageDto } from './dto/language.dto';
import type { OperatingHourDto } from './dto/operating-hour.dto';
import type { RoomDto } from './dto/room.dto';
import type { SchoolPhaseDto } from './dto/school-phase.dto';
import type { SubjectOfferingDto } from './dto/subject-offering.dto';
import type { SubjectDto } from './dto/subject.dto';
import type { TermDto } from './dto/term.dto';
import type { AchievementLevelRow } from './rows/achievement-level.row';
import type { AssessmentDomainRow } from './rows/assessment-domain.row';
import type { AssessmentTypeRow } from './rows/assessment-type.row';
import type { ConsentTypeRow } from './rows/consent-type.row';
import type { GradeRow } from './rows/grade.row';
import type { LanguageRow } from './rows/language.row';
import type { OperatingHourRow } from './rows/operating-hour.row';
import type { RoomRow } from './rows/room.row';
import type { SchoolPhaseRow } from './rows/school-phase.row';
import type { SubjectOfferingRow } from './rows/subject-offering.row';
import type { SubjectRow } from './rows/subject.row';
import type { TermRow } from './rows/term.row';

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
