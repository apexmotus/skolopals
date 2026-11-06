import type { AuthorisedCollectorDto } from './dto/authorised-collector.dto';
import type { EmergencyContactDto } from './dto/emergency-contact.dto';
import type { LearnerGuardianDto } from './dto/learner-guardian.dto';
import type { LearnerDto } from './dto/learner.dto';
import type { MedicalNotesDto } from './dto/medical-notes.dto';
import type { MyProfileDto } from './dto/profile.dto';
import type { AuthorisedCollectorRow } from './rows/authorised-collector.row';
import type { EmergencyContactRow } from './rows/emergency-contact.row';
import type { LearnerGuardianRow } from './rows/learner-guardian.row';
import type { LearnerRow } from './rows/learner.row';
import type { MedicalNotesRow } from './rows/medical-notes.row';
import type { ProfileRow } from './rows/profile.row';

export class PeopleMapper {
  static profileToMyProfileDto(row: ProfileRow, email: string): MyProfileDto {
    return {
      id: row.id,
      fullName: row.full_name,
      phone: row.phone ?? undefined,
      email,
      createdAt: row.created_at.toISOString(),
    };
  }

  static learnerToDto(row: LearnerRow): LearnerDto {
    return {
      id: row.id,
      profileId: row.profile_id ?? undefined,
      fullName: row.full_name,
      dateOfBirth: row.date_of_birth,
      gradeCode: row.grade_code,
      schoolName: row.school_name,
      homeLanguageCode: row.home_language_code ?? undefined,
      status: row.status,
      joinedOn: row.joined_on,
      leftOn: row.left_on ?? undefined,
    };
  }

  static learnerGuardianToDto(row: LearnerGuardianRow): LearnerGuardianDto {
    return {
      learnerId: row.learner_id,
      guardianId: row.guardian_id,
      guardianName: row.guardian_name ?? undefined,
      guardianPhone: row.guardian_phone ?? undefined,
      relationship: row.relationship,
      isPrimary: row.is_primary,
      isBillingContact: row.is_billing_contact,
    };
  }

  static emergencyContactToDto(row: EmergencyContactRow): EmergencyContactDto {
    return {
      id: row.id,
      learnerId: row.learner_id,
      fullName: row.full_name,
      relationship: row.relationship,
      phone: row.phone,
      priority: row.priority,
    };
  }

  static collectorToDto(row: AuthorisedCollectorRow): AuthorisedCollectorDto {
    return {
      id: row.id,
      learnerId: row.learner_id,
      fullName: row.full_name,
      relationship: row.relationship,
      phone: row.phone,
      idNumberLast4: row.id_number_last4 ?? undefined,
      activeFrom: row.active_from,
      activeTo: row.active_to ?? undefined,
    };
  }

  static medicalNotesToDto(row: MedicalNotesRow): MedicalNotesDto {
    return {
      learnerId: row.learner_id,
      allergies: row.allergies,
      conditions: row.conditions,
      medication: row.medication,
      accommodations: row.accommodations,
      updatedAt: row.updated_at.toISOString(),
      updatedBy: row.updated_by ?? undefined,
    };
  }

  static emptyMedicalNotes(learnerId: string): MedicalNotesDto {
    return {
      learnerId,
      allergies: '',
      conditions: '',
      medication: '',
      accommodations: '',
    };
  }
}
