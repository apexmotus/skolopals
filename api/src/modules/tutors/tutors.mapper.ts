import type { TutorDocumentDto } from './dto/tutor-document.dto.js';
import type { TutorPayRateDto } from './dto/tutor-pay-rate.dto.js';
import type { TutorQualificationDto } from './dto/tutor-qualification.dto.js';
import type { TutorReferenceDto } from './dto/tutor-reference.dto.js';
import type { TutorSpokenLanguageDto } from './dto/tutor-spoken-language.dto.js';
import type { TutorCompetencyDto } from './dto/tutor-competency.dto.js';
import type { TutorDto } from './dto/tutor.dto.js';
import type { TutorCompetencyRow } from './rows/tutor-competency.row.js';
import type { TutorDocumentRow } from './rows/tutor-document.row.js';
import type { TutorPayRateRow } from './rows/tutor-pay-rate.row.js';
import type { TutorQualificationRow } from './rows/tutor-qualification.row.js';
import type { TutorReferenceRow } from './rows/tutor-reference.row.js';
import type { TutorSessionLoadDto } from './dto/tutor-session-load.dto.js';
import type { TutorSessionLoadRow } from './rows/tutor-session-load.row.js';
import type { TutorSpokenLanguageRow } from './rows/tutor-spoken-language.row.js';
import type { TutorRatingRow, TutorRow } from './rows/tutor.row.js';

export class TutorsMapper {
  static toDto(row: TutorRow, rating?: TutorRatingRow): TutorDto {
    return {
      id: row.id,
      slug: row.slug,
      fullName: row.full_name,
      headline: row.headline,
      bio: row.bio,
      photoUrl: row.photo_url ?? undefined,
      employmentType: row.employment_type,
      status: row.status,
      rating: rating ? Number(rating.rating) : undefined,
      reviewCount: rating ? Number(rating.review_count) : undefined,
    };
  }

  static competencyToDto(row: TutorCompetencyRow): TutorCompetencyDto {
    return {
      id: row.id,
      tutorId: row.tutor_id,
      subjectCode: row.subject_code,
      gradeCode: row.grade_code,
      mediaLanguageCodes: row.media_language_codes,
    };
  }

  static spokenLanguageToDto(
    row: TutorSpokenLanguageRow,
  ): TutorSpokenLanguageDto {
    return { languageCode: row.language_code };
  }

  static qualificationToDto(row: TutorQualificationRow): TutorQualificationDto {
    return {
      id: row.id,
      tutorId: row.tutor_id,
      qualificationType: row.qualification_type,
      title: row.title,
      institution: row.institution,
      yearAwarded: row.year_awarded ?? undefined,
      verifiedAt: row.verified_at?.toISOString(),
    };
  }

  static documentToDto(
    row: TutorDocumentRow,
    downloadUrl?: string,
  ): TutorDocumentDto {
    return {
      id: row.id,
      tutorId: row.tutor_id,
      docType: row.doc_type,
      uploadedAt: row.uploaded_at.toISOString(),
      verifiedAt: row.verified_at?.toISOString(),
      downloadUrl,
    };
  }

  static referenceToDto(row: TutorReferenceRow): TutorReferenceDto {
    return {
      id: row.id,
      tutorId: row.tutor_id,
      fullName: row.full_name,
      relationship: row.relationship,
      phone: row.phone,
      email: row.email,
      checkedAt: row.checked_at?.toISOString(),
      outcome: row.outcome ?? undefined,
    };
  }

  static payRateToDto(row: TutorPayRateRow): TutorPayRateDto {
    return {
      id: row.id,
      tutorId: row.tutor_id,
      payBasis: row.pay_basis,
      amountCents: row.amount_cents,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to ?? undefined,
    };
  }

  static sessionLoadToDto(row: TutorSessionLoadRow): TutorSessionLoadDto {
    return {
      month: row.month,
      sessions: Number(row.sessions),
      hours: Number(row.hours),
    };
  }
}
