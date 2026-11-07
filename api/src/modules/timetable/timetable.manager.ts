import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../common/cache/cache.service';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { PagedResult } from '../../common/types/paged-result';
import type { AuthUser } from '../../common/types/auth-user';
import { UnitOfWork } from '../../database/unit-of-work';
import type {
  ClassEnrolmentDto,
  PlaceLearnerDto,
} from './dto/class-enrolment.dto';
import type {
  ClassGroupDto,
  CreateClassGroupDto,
  ListClassGroupsQueryDto,
  UpdateClassGroupDto,
} from './dto/class-group.dto';
import type { AddClassScheduleDto, ClassScheduleDto } from './dto/class-schedule.dto';
import type {
  ClassSessionDto,
  ListClassSessionsQueryDto,
  UpdateClassSessionStatusDto,
} from './dto/class-session.dto';
import type { PublicTimetableEntryDto } from './dto/public-timetable.dto';
import { timetableCacheKeys, TIMETABLE_CACHE_TTL_SECONDS } from './timetable-cache-keys';
import { TimetableMapper } from './timetable.mapper';
import { TimetableRepository } from './timetable.repository';

@Injectable()
export class TimetableManager {
  constructor(
    private readonly repo: TimetableRepository,
    private readonly cache: CacheService,
    private readonly uow: UnitOfWork,
  ) {}

  /** Same content for every viewer — the view itself already filters to active classes/tutors, so caching is unconditional. */
  async getPublicTimetable(): Promise<PublicTimetableEntryDto[]> {
    const cached = await this.cache.get<PublicTimetableEntryDto[]>(
      timetableCacheKeys.publicTimetable,
    );
    if (cached) return cached;
    const dtos = (await this.repo.getPublicTimetable()).map((row) =>
      TimetableMapper.publicEntryToDto(row),
    );
    await this.cache.set(
      timetableCacheKeys.publicTimetable,
      dtos,
      TIMETABLE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  /**
   * `class_groups`' own RLS policy (`is_active or is_admin()`) already
   * decides whether inactive classes are included — no Manager branch like
   * `packages`' needed for that. Caching is still actor-gated: an admin's
   * response includes rows an anon/parent/tutor response would not, so only
   * the non-admin shape is ever cached, and only for the unfiltered query.
   */
  async listClassGroups(
    query: ListClassGroupsQueryDto,
    actor: AuthUser | undefined,
  ): Promise<ClassGroupDto[]> {
    const isAdmin = actor?.roles.includes('admin') ?? false;
    const cacheable = !isAdmin && !query.termId && !query.tutorId;
    if (cacheable) {
      const cached = await this.cache.get<ClassGroupDto[]>(timetableCacheKeys.listActive);
      if (cached) return cached;
    }

    const rows = await this.repo.listClassGroups({
      termId: query.termId,
      tutorId: query.tutorId,
    });
    const gradesByGroup = await this.repo.listGradeCodesForMany(rows.map((row) => row.id));
    const dtos = rows.map((row) =>
      TimetableMapper.classGroupToDto(row, gradesByGroup.get(row.id) ?? []),
    );

    if (cacheable) {
      await this.cache.set(timetableCacheKeys.listActive, dtos, TIMETABLE_CACHE_TTL_SECONDS);
    }
    return dtos;
  }

  async getClassGroupById(
    id: string,
    actor: AuthUser | undefined,
  ): Promise<ClassGroupDto> {
    const isAdmin = actor?.roles.includes('admin') ?? false;
    if (!isAdmin) {
      const cached = await this.cache.get<ClassGroupDto>(timetableCacheKeys.classGroupById(id));
      if (cached) return cached;
    }

    const row = await this.repo.getClassGroupById(id);
    if (!row) throw new NotFoundException('Class group not found.');
    const gradeCodes = await this.repo.listGradeCodes(id);
    const dto = TimetableMapper.classGroupToDto(row, gradeCodes);

    if (!isAdmin) {
      await this.cache.set(
        timetableCacheKeys.classGroupById(id),
        dto,
        TIMETABLE_CACHE_TTL_SECONDS,
      );
    }
    return dto;
  }

  async createClassGroup(dto: CreateClassGroupDto): Promise<ClassGroupDto> {
    await this.assertTutorCompetent({
      tutorId: dto.tutorId,
      subjectCode: dto.subjectCode,
      languageCode: dto.languageCode,
      gradeCodes: dto.gradeCodes,
    });

    const row = await this.uow.run(async () => {
      const created = await this.repo.insertClassGroup(dto);
      await this.repo.insertClassGroupGrades(created.id, dto.gradeCodes);
      return created;
    });

    await this.invalidateCaches();
    return TimetableMapper.classGroupToDto(row, dto.gradeCodes);
  }

  async updateClassGroup(id: string, dto: UpdateClassGroupDto): Promise<ClassGroupDto> {
    const existing = await this.repo.getClassGroupById(id);
    if (!existing) throw new NotFoundException('Class group not found.');

    const competencyRelevant =
      dto.tutorId !== undefined ||
      dto.subjectCode !== undefined ||
      dto.languageCode !== undefined ||
      dto.gradeCodes !== undefined;
    if (competencyRelevant) {
      const effectiveGradeCodes = dto.gradeCodes ?? (await this.repo.listGradeCodes(id));
      await this.assertTutorCompetent({
        tutorId: dto.tutorId ?? existing.tutor_id,
        subjectCode: dto.subjectCode ?? existing.subject_code,
        languageCode: dto.languageCode ?? existing.language_code,
        gradeCodes: effectiveGradeCodes,
      });
    }

    const row = await this.uow.run(async () => {
      const updated = await this.repo.updateClassGroup(id, dto);
      if (dto.gradeCodes !== undefined) {
        await this.repo.clearClassGroupGrades(id);
        await this.repo.insertClassGroupGrades(id, dto.gradeCodes);
      }
      return updated;
    });
    if (!row) throw new NotFoundException('Class group not found.');

    const gradeCodes = dto.gradeCodes ?? (await this.repo.listGradeCodes(id));
    await this.invalidateCaches(id);
    return TimetableMapper.classGroupToDto(row, gradeCodes);
  }

  async addSchedule(classGroupId: string, dto: AddClassScheduleDto): Promise<ClassScheduleDto> {
    const row = await this.repo.addSchedule(classGroupId, dto);
    await this.invalidateCaches(classGroupId);
    return TimetableMapper.scheduleToDto(row);
  }

  async removeSchedule(classGroupId: string, scheduleId: string): Promise<void> {
    const rowCount = await this.repo.removeSchedule(classGroupId, scheduleId);
    if (rowCount === 0) throw new NotFoundException('Schedule not found.');
    await this.invalidateCaches(classGroupId);
  }

  async generateSessions(classGroupId: string): Promise<{ sessionsCreated: number }> {
    const sessionsCreated = await this.repo.generateSessions(classGroupId);
    return { sessionsCreated };
  }

  async listSessionsForParticipant(
    query: ListClassSessionsQueryDto,
  ): Promise<PagedResult<ClassSessionDto>> {
    const { rows, totalCount } = await this.repo.listSessions({
      classGroupId: query.classGroupId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return new PagedResult(
      rows.map((row) => TimetableMapper.sessionToDto(row)),
      query.page,
      query.pageSize,
      totalCount,
    );
  }

  async updateSessionStatus(
    id: string,
    dto: UpdateClassSessionStatusDto,
  ): Promise<ClassSessionDto> {
    const row = await this.repo.updateSessionStatus(id, dto);
    if (!row) throw new NotFoundException('Class session not found.');
    return TimetableMapper.sessionToDto(row);
  }

  async listPlacements(classGroupId: string): Promise<ClassEnrolmentDto[]> {
    const rows = await this.repo.listPlacements(classGroupId);
    return rows.map((row) => TimetableMapper.placementToDto(row));
  }

  async placeLearner(classGroupId: string, dto: PlaceLearnerDto): Promise<ClassEnrolmentDto> {
    const row = await this.repo.placeLearner(classGroupId, dto.learnerId, dto.enrolmentId);
    return TimetableMapper.placementToDto(row);
  }

  async withdraw(classGroupId: string, placementId: string): Promise<ClassEnrolmentDto> {
    const row = await this.repo.withdrawPlacement(classGroupId, placementId);
    if (!row) throw new NotFoundException('Placement not found, or already withdrawn.');
    return TimetableMapper.placementToDto(row);
  }

  /** `class_groups`/`class_group_grades`' own deferred trigger is the authority; this only gives a clean synchronous error before anything is written. */
  private async assertTutorCompetent(input: {
    tutorId: string;
    subjectCode: string;
    languageCode: string;
    gradeCodes: string[];
  }): Promise<void> {
    const missing = await this.repo.findMissingCompetencies(input);
    if (missing.length > 0) {
      throw new BusinessRuleException(
        'TUTOR_NOT_COMPETENT',
        `Tutor is not recorded as teaching ${input.subjectCode} in ${input.languageCode} at: ${missing.join(', ')}`,
      );
    }
  }

  private async invalidateCaches(classGroupId?: string): Promise<void> {
    await this.cache.del(timetableCacheKeys.listActive);
    await this.cache.del(timetableCacheKeys.publicTimetable);
    if (classGroupId) await this.cache.del(timetableCacheKeys.classGroupById(classGroupId));
  }
}
