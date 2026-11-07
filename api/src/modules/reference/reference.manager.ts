import { Injectable } from '@nestjs/common';
import { CacheService } from '../../common/cache/cache.service';
import {
  referenceCacheKeys,
  REFERENCE_CACHE_TTL_SECONDS,
} from './reference-cache-keys';
import type { AchievementLevelDto } from './dto/achievement-level.dto';
import type { AssessmentDomainDto } from './dto/assessment-domain.dto';
import type { AssessmentTypeDto } from './dto/assessment-type.dto';
import type { ConsentTypeDto } from './dto/consent-type.dto';
import type { GradeDto } from './dto/grade.dto';
import type { LanguageDto } from './dto/language.dto';
import type { OperatingHourDto } from './dto/operating-hour.dto';
import type { CreateRoomDto, RoomDto } from './dto/room.dto';
import type { SchoolPhaseDto } from './dto/school-phase.dto';
import type { SubjectOfferingDto } from './dto/subject-offering.dto';
import type { SubjectDto } from './dto/subject.dto';
import type { CreateTermDto, TermDto } from './dto/term.dto';
import { ReferenceMapper } from './reference.mapper';
import { ReferenceRepository } from './reference.repository';

@Injectable()
export class ReferenceManager {
  constructor(
    private readonly repo: ReferenceRepository,
    private readonly cache: CacheService,
  ) {}

  async listPhases(): Promise<SchoolPhaseDto[]> {
    const cached = await this.cache.get<SchoolPhaseDto[]>(
      referenceCacheKeys.phases,
    );
    if (cached) return cached;
    const dtos = (await this.repo.listPhases()).map((row) =>
      ReferenceMapper.schoolPhaseToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.phases,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async listGrades(): Promise<GradeDto[]> {
    const cached = await this.cache.get<GradeDto[]>(referenceCacheKeys.grades);
    if (cached) return cached;
    const dtos = (await this.repo.listGrades()).map((row) =>
      ReferenceMapper.gradeToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.grades,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async listSubjects(): Promise<SubjectDto[]> {
    const cached = await this.cache.get<SubjectDto[]>(
      referenceCacheKeys.subjects,
    );
    if (cached) return cached;
    const dtos = (await this.repo.listSubjects()).map((row) =>
      ReferenceMapper.subjectToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.subjects,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async listOfferings(gradeCode?: string): Promise<SubjectOfferingDto[]> {
    const key = referenceCacheKeys.subjectOfferings(gradeCode ?? null);
    const cached = await this.cache.get<SubjectOfferingDto[]>(key);
    if (cached) return cached;
    const dtos = (await this.repo.listOfferings(gradeCode ?? null)).map((row) =>
      ReferenceMapper.subjectOfferingToDto(row),
    );
    await this.cache.set(key, dtos, REFERENCE_CACHE_TTL_SECONDS);
    return dtos;
  }

  async listLanguages(): Promise<LanguageDto[]> {
    const cached = await this.cache.get<LanguageDto[]>(
      referenceCacheKeys.languages,
    );
    if (cached) return cached;
    const dtos = (await this.repo.listLanguages()).map((row) =>
      ReferenceMapper.languageToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.languages,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async listAchievementLevels(): Promise<AchievementLevelDto[]> {
    const cached = await this.cache.get<AchievementLevelDto[]>(
      referenceCacheKeys.achievementLevels,
    );
    if (cached) return cached;
    const dtos = (await this.repo.listAchievementLevels()).map((row) =>
      ReferenceMapper.achievementLevelToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.achievementLevels,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async listAssessmentTypes(): Promise<AssessmentTypeDto[]> {
    const cached = await this.cache.get<AssessmentTypeDto[]>(
      referenceCacheKeys.assessmentTypes,
    );
    if (cached) return cached;
    const dtos = (await this.repo.listAssessmentTypes()).map((row) =>
      ReferenceMapper.assessmentTypeToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.assessmentTypes,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async listAssessmentDomains(): Promise<AssessmentDomainDto[]> {
    const cached = await this.cache.get<AssessmentDomainDto[]>(
      referenceCacheKeys.assessmentDomains,
    );
    if (cached) return cached;
    const dtos = (await this.repo.listAssessmentDomains()).map((row) =>
      ReferenceMapper.assessmentDomainToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.assessmentDomains,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async listConsentTypes(): Promise<ConsentTypeDto[]> {
    const cached = await this.cache.get<ConsentTypeDto[]>(
      referenceCacheKeys.consentTypes,
    );
    if (cached) return cached;
    const dtos = (await this.repo.listConsentTypes()).map((row) =>
      ReferenceMapper.consentTypeToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.consentTypes,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async listTerms(): Promise<TermDto[]> {
    const cached = await this.cache.get<TermDto[]>(referenceCacheKeys.terms);
    if (cached) return cached;
    const dtos = (await this.repo.listTerms()).map((row) =>
      ReferenceMapper.termToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.terms,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async createTerm(dto: CreateTermDto): Promise<TermDto> {
    const row = await this.repo.createTerm({
      year: dto.year,
      termNumber: dto.termNumber,
      startsOn: dto.startsOn,
      endsOn: dto.endsOn,
    });
    await this.cache.del(referenceCacheKeys.terms);
    return ReferenceMapper.termToDto(row);
  }

  async listOperatingHours(): Promise<OperatingHourDto[]> {
    const cached = await this.cache.get<OperatingHourDto[]>(
      referenceCacheKeys.operatingHours,
    );
    if (cached) return cached;
    const dtos = (await this.repo.listOperatingHours()).map((row) =>
      ReferenceMapper.operatingHourToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.operatingHours,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async listRooms(): Promise<RoomDto[]> {
    const cached = await this.cache.get<RoomDto[]>(referenceCacheKeys.rooms);
    if (cached) return cached;
    const dtos = (await this.repo.listRooms()).map((row) =>
      ReferenceMapper.roomToDto(row),
    );
    await this.cache.set(
      referenceCacheKeys.rooms,
      dtos,
      REFERENCE_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async createRoom(dto: CreateRoomDto): Promise<RoomDto> {
    const row = await this.repo.createRoom({
      name: dto.name,
      capacity: dto.capacity,
      isActive: dto.isActive,
    });
    await this.cache.del(referenceCacheKeys.rooms);
    return ReferenceMapper.roomToDto(row);
  }
}
