import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { PagedResult } from '../../common/types/paged-result';
import type { AuthUser } from '../../common/types/auth-user';
import type {
  AddCollectorDto,
  AuthorisedCollectorDto,
} from './dto/authorised-collector.dto';
import type {
  AddEmergencyContactDto,
  EmergencyContactDto,
} from './dto/emergency-contact.dto';
import type {
  AddGuardianDto,
  LearnerGuardianDto,
  SetContactFlagsDto,
} from './dto/learner-guardian.dto';
import type {
  CreateLearnerDto,
  LearnerDto,
  ListLearnersQueryDto,
  UpdateLearnerDto,
} from './dto/learner.dto';
import type {
  MedicalNotesDto,
  UpsertMedicalNotesDto,
} from './dto/medical-notes.dto';
import type { MyProfileDto, UpdateMyProfileDto } from './dto/profile.dto';
import { PeopleMapper } from './people.mapper';
import { PeopleRepository } from './people.repository';

@Injectable()
export class PeopleManager {
  constructor(private readonly repo: PeopleRepository) {}

  async getMyProfile(actor: AuthUser): Promise<MyProfileDto> {
    const row = await this.repo.getProfileById(actor.id);
    if (!row) throw new NotFoundException('Profile not found.');
    const email =
      typeof actor.claims.email === 'string' ? actor.claims.email : '';
    return PeopleMapper.profileToMyProfileDto(row, email, actor.roles);
  }

  async updateMyProfile(
    actor: AuthUser,
    dto: UpdateMyProfileDto,
  ): Promise<MyProfileDto> {
    const row = await this.repo.updateProfile(actor.id, dto);
    const email =
      typeof actor.claims.email === 'string' ? actor.claims.email : '';
    return PeopleMapper.profileToMyProfileDto(row, email, actor.roles);
  }

  async getLearnerById(id: string): Promise<LearnerDto> {
    await this.requireCanView(id);
    const row = await this.repo.getLearnerById(id);
    if (!row) throw new NotFoundException('Learner not found.');
    return PeopleMapper.learnerToDto(row);
  }

  async listLearners(
    query: ListLearnersQueryDto,
  ): Promise<PagedResult<LearnerDto>> {
    const { rows, totalCount } = await this.repo.listLearners({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      gradeCode: query.gradeCode,
      status: query.status,
    });
    return new PagedResult(
      rows.map((row) => PeopleMapper.learnerToDto(row)),
      query.page,
      query.pageSize,
      totalCount,
    );
  }

  async createLearner(dto: CreateLearnerDto): Promise<LearnerDto> {
    const row = await this.repo.createLearner(dto);
    return PeopleMapper.learnerToDto(row);
  }

  async updateLearner(id: string, dto: UpdateLearnerDto): Promise<LearnerDto> {
    await this.requireCanViewPrivate(id);
    const current = await this.repo.getLearnerById(id);
    if (!current) throw new NotFoundException('Learner not found.');

    const status = dto.status ?? current.status;
    const leftOn =
      dto.leftOn ?? (status === current.status ? current.left_on : null);
    if ((status === 'left') !== (leftOn !== null)) {
      throw new BusinessRuleException(
        'LEARNER_STATUS_LEFT_ON_MISMATCH',
        'A learner\'s status is "left" exactly when leftOn is set — provide both together.',
      );
    }

    const row = await this.repo.updateLearner(id, {
      fullName: dto.fullName ?? current.full_name,
      gradeCode: dto.gradeCode ?? current.grade_code,
      schoolName: dto.schoolName ?? current.school_name,
      homeLanguageCode: dto.homeLanguageCode ?? current.home_language_code,
      status,
      leftOn,
    });
    if (!row) throw new NotFoundException('Learner not found.');
    return PeopleMapper.learnerToDto(row);
  }

  async listGuardians(learnerId: string): Promise<LearnerGuardianDto[]> {
    await this.requireCanView(learnerId);
    const rows = await this.repo.listGuardians(learnerId);
    return rows.map((row) => PeopleMapper.learnerGuardianToDto(row));
  }

  async addGuardian(
    learnerId: string,
    dto: AddGuardianDto,
  ): Promise<LearnerGuardianDto> {
    await this.requireCanViewPrivate(learnerId);
    const row = await this.repo.addGuardian(learnerId, dto);
    return PeopleMapper.learnerGuardianToDto(row);
  }

  async setContactFlags(
    learnerId: string,
    guardianId: string,
    dto: SetContactFlagsDto,
  ): Promise<LearnerGuardianDto> {
    await this.requireCanViewPrivate(learnerId);
    const row = await this.repo.setContactFlags(learnerId, guardianId, dto);
    if (!row) throw new NotFoundException('Guardian link not found.');
    return PeopleMapper.learnerGuardianToDto(row);
  }

  async listEmergencyContacts(
    learnerId: string,
  ): Promise<EmergencyContactDto[]> {
    await this.requireCanViewPrivate(learnerId);
    const rows = await this.repo.listEmergencyContacts(learnerId);
    return rows.map((row) => PeopleMapper.emergencyContactToDto(row));
  }

  async addEmergencyContact(
    learnerId: string,
    dto: AddEmergencyContactDto,
  ): Promise<EmergencyContactDto> {
    await this.requireCanViewPrivate(learnerId);
    const row = await this.repo.addEmergencyContact(learnerId, dto);
    return PeopleMapper.emergencyContactToDto(row);
  }

  async removeEmergencyContact(
    learnerId: string,
    contactId: string,
  ): Promise<void> {
    await this.requireCanViewPrivate(learnerId);
    const rowCount = await this.repo.removeEmergencyContact(
      learnerId,
      contactId,
    );
    if (rowCount === 0)
      throw new NotFoundException('Emergency contact not found.');
  }

  async listCollectors(learnerId: string): Promise<AuthorisedCollectorDto[]> {
    await this.requireCanViewPrivate(learnerId);
    const rows = await this.repo.listCollectors(learnerId);
    return rows.map((row) => PeopleMapper.collectorToDto(row));
  }

  async addCollector(
    learnerId: string,
    dto: AddCollectorDto,
  ): Promise<AuthorisedCollectorDto> {
    await this.requireCanViewPrivate(learnerId);
    const row = await this.repo.addCollector(learnerId, dto);
    return PeopleMapper.collectorToDto(row);
  }

  async removeCollector(learnerId: string, collectorId: string): Promise<void> {
    await this.requireCanViewPrivate(learnerId);
    const rowCount = await this.repo.removeCollector(learnerId, collectorId);
    if (rowCount === 0)
      throw new NotFoundException('Authorised collector not found.');
  }

  /** Never 404s on a missing row: no medical notes recorded yet is a valid, non-error state. */
  async getMedicalNotes(learnerId: string): Promise<MedicalNotesDto> {
    await this.requireCanViewPrivate(learnerId);
    const row = await this.repo.getMedicalNotes(learnerId);
    return row
      ? PeopleMapper.medicalNotesToDto(row)
      : PeopleMapper.emptyMedicalNotes(learnerId);
  }

  async upsertMedicalNotes(
    learnerId: string,
    actor: AuthUser,
    dto: UpsertMedicalNotesDto,
  ): Promise<MedicalNotesDto> {
    await this.requireCanViewPrivate(learnerId);
    const row = await this.repo.upsertMedicalNotes(learnerId, dto, actor.id);
    return PeopleMapper.medicalNotesToDto(row);
  }

  /** "Can view learner" (academic tier) — guardian, the learner, a teaching tutor, or admin. Never shortcut to a role check alone. */
  private async requireCanView(learnerId: string): Promise<void> {
    const allowed = await this.repo.canViewLearner(learnerId);
    if (!allowed) throw new NotFoundException('Learner not found.'); // 404, never 403 — see 03-endpoints-and-business-rules.md
  }

  /** "Can view learner — private" tier (billing/safeguarding) — guardian or admin ONLY. Tutors are excluded even if they teach the learner — the POPIA boundary. */
  private async requireCanViewPrivate(learnerId: string): Promise<void> {
    const allowed = await this.repo.canViewLearnerPrivate(learnerId);
    if (!allowed) throw new NotFoundException('Learner not found.');
  }
}
