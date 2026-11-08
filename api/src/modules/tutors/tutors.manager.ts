import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../common/cache/cache.service.js';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception.js';
import { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import { PagedResult } from '../../common/types/paged-result.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import type {
  AddDocumentDto,
  TutorDocumentDto,
  UploadDocumentResponseDto,
} from './dto/tutor-document.dto.js';
import type {
  AddQualificationDto,
  TutorQualificationDto,
} from './dto/tutor-qualification.dto.js';
import type {
  AddReferenceDto,
  RecordOutcomeDto,
  TutorReferenceDto,
} from './dto/tutor-reference.dto.js';
import type { SetPayRateDto, TutorPayRateDto } from './dto/tutor-pay-rate.dto.js';
import type {
  SetSpokenLanguagesDto,
  TutorSpokenLanguageDto,
} from './dto/tutor-spoken-language.dto.js';
import type {
  SetCompetencyDto,
  TutorCompetencyDto,
} from './dto/tutor-competency.dto.js';
import type {
  CreateTutorDto,
  ListPublicTutorsQueryDto,
  TutorDto,
  UpdateMyTutorProfileDto,
} from './dto/tutor.dto.js';
import { tutorsCacheKeys, TUTORS_CACHE_TTL_SECONDS } from './tutors-cache-keys.js';
import { TutorsMapper } from './tutors.mapper.js';
import { TutorsRepository } from './tutors.repository.js';

@Injectable()
export class TutorsManager {
  constructor(
    private readonly repo: TutorsRepository,
    private readonly cache: CacheService,
    private readonly uow: UnitOfWork,
    private readonly fileStorage: FileStorageService,
  ) {}

  async listPublic(
    query: ListPublicTutorsQueryDto,
  ): Promise<PagedResult<TutorDto>> {
    const { rows, totalCount } = await this.repo.listPublic({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });
    return new PagedResult(
      rows.map((row) => TutorsMapper.toDto(row)),
      query.page,
      query.pageSize,
      totalCount,
    );
  }

  async getBySlug(slug: string): Promise<TutorDto> {
    const cached = await this.cache.get<TutorDto>(tutorsCacheKeys.bySlug(slug));
    if (cached) return cached;

    const row = await this.repo.getBySlug(slug);
    if (!row) throw new NotFoundException('Tutor not found.');
    const rating = await this.repo.getRating(row.id);
    const dto = TutorsMapper.toDto(row, rating);
    await this.cache.set(
      tutorsCacheKeys.bySlug(slug),
      dto,
      TUTORS_CACHE_TTL_SECONDS,
    );
    return dto;
  }

  async getMyProfile(actor: AuthUser): Promise<TutorDto> {
    const row = await this.repo.getByProfileId(actor.id);
    if (!row) throw new NotFoundException('Tutor profile not found.');
    const rating = await this.repo.getRating(row.id);
    return TutorsMapper.toDto(row, rating);
  }

  async updateMyProfile(
    actor: AuthUser,
    dto: UpdateMyTutorProfileDto,
  ): Promise<TutorDto> {
    const row = await this.repo.updateMyProfile(actor.id, dto);
    await this.cache.del(tutorsCacheKeys.bySlug(row.slug));
    return TutorsMapper.toDto(row);
  }

  /** BR-23: `create_tutor` raises a P0001 (mapped to a generic 422) when no account exists for the email — that specific case is really a 404 ("ask them to sign up first"), so it's remapped here. */
  async createTutor(dto: CreateTutorDto): Promise<TutorDto> {
    let newId: string;
    try {
      newId = await this.repo.createTutor(dto);
    } catch (err) {
      if (err instanceof BusinessRuleException) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
    const row = await this.repo.getById(newId);
    if (!row) throw new Error('Freshly created tutor could not be re-read');
    return TutorsMapper.toDto(row);
  }

  async listCompetencies(tutorId: string): Promise<TutorCompetencyDto[]> {
    const cached = await this.cache.get<TutorCompetencyDto[]>(
      tutorsCacheKeys.competencies(tutorId),
    );
    if (cached) return cached;
    const dtos = (await this.repo.listCompetencies(tutorId)).map((row) =>
      TutorsMapper.competencyToDto(row),
    );
    await this.cache.set(
      tutorsCacheKeys.competencies(tutorId),
      dtos,
      TUTORS_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async setCompetency(
    tutorId: string,
    dto: SetCompetencyDto,
  ): Promise<TutorCompetencyDto> {
    const id = await this.repo.setCompetency({
      tutorId,
      subjectCode: dto.subjectCode,
      gradeCode: dto.gradeCode,
      mediaLanguageCodes: dto.mediaLanguageCodes,
    });
    const row = await this.repo.getCompetencyById(id);
    if (!row) throw new Error('Freshly set competency could not be re-read');
    await this.cache.del(tutorsCacheKeys.competencies(tutorId));
    return TutorsMapper.competencyToDto(row);
  }

  async listSpokenLanguages(
    tutorId: string,
  ): Promise<TutorSpokenLanguageDto[]> {
    const rows = await this.repo.listSpokenLanguages(tutorId);
    return rows.map((row) => TutorsMapper.spokenLanguageToDto(row));
  }

  async setSpokenLanguages(
    tutorId: string,
    dto: SetSpokenLanguagesDto,
  ): Promise<TutorSpokenLanguageDto[]> {
    await this.uow.run(async () => {
      await this.repo.clearSpokenLanguages(tutorId);
      await this.repo.insertSpokenLanguages(tutorId, dto.languageCodes);
    });
    return this.listSpokenLanguages(tutorId);
  }

  async listQualifications(tutorId: string): Promise<TutorQualificationDto[]> {
    const cached = await this.cache.get<TutorQualificationDto[]>(
      tutorsCacheKeys.qualifications(tutorId),
    );
    if (cached) return cached;
    const dtos = (await this.repo.listQualifications(tutorId)).map((row) =>
      TutorsMapper.qualificationToDto(row),
    );
    await this.cache.set(
      tutorsCacheKeys.qualifications(tutorId),
      dtos,
      TUTORS_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async addQualification(
    tutorId: string,
    dto: AddQualificationDto,
  ): Promise<TutorQualificationDto> {
    const row = await this.repo.addQualification(tutorId, dto);
    await this.cache.del(tutorsCacheKeys.qualifications(tutorId));
    return TutorsMapper.qualificationToDto(row);
  }

  /** Vetting material — admin-only, never proxies bytes through the API (Phase 0 §3 / Phase 1 file-storage design). */
  async listDocuments(tutorId: string): Promise<TutorDocumentDto[]> {
    const rows = await this.repo.listDocuments(tutorId);
    return Promise.all(
      rows.map(async (row) => {
        const downloadUrl = await this.fileStorage.createDownloadUrl(
          row.storage_path,
        );
        return TutorsMapper.documentToDto(row, downloadUrl);
      }),
    );
  }

  async uploadDocument(
    tutorId: string,
    dto: AddDocumentDto,
  ): Promise<UploadDocumentResponseDto> {
    const extension = dto.fileName.slice(dto.fileName.lastIndexOf('.'));
    const storagePath = `${tutorId}/${dto.docType}/${randomUUID()}${extension}`;
    const { signedUrl, token } =
      await this.fileStorage.createUploadUrl(storagePath);
    const row = await this.repo.createDocumentRecord(
      tutorId,
      dto.docType,
      storagePath,
    );
    return {
      document: TutorsMapper.documentToDto(row),
      uploadUrl: signedUrl,
      uploadToken: token,
    };
  }

  async listReferences(tutorId: string): Promise<TutorReferenceDto[]> {
    const rows = await this.repo.listReferences(tutorId);
    return rows.map((row) => TutorsMapper.referenceToDto(row));
  }

  async addReference(
    tutorId: string,
    dto: AddReferenceDto,
  ): Promise<TutorReferenceDto> {
    const row = await this.repo.addReference(tutorId, dto);
    return TutorsMapper.referenceToDto(row);
  }

  async recordOutcome(
    tutorId: string,
    referenceId: string,
    actor: AuthUser,
    dto: RecordOutcomeDto,
  ): Promise<TutorReferenceDto> {
    const row = await this.repo.recordReferenceOutcome(
      tutorId,
      referenceId,
      dto.outcome,
      actor.id,
    );
    if (!row) throw new NotFoundException('Tutor reference not found.');
    return TutorsMapper.referenceToDto(row);
  }

  /** "Tutor (own), Admin" — enforced by `tutor_pay_rates`' own RLS policy (`tutor_id = my_tutor_id() or is_admin()`); anyone else's query simply returns nothing. */
  async listPayRates(tutorId: string): Promise<TutorPayRateDto[]> {
    const rows = await this.repo.listPayRates(tutorId);
    return rows.map((row) => TutorsMapper.payRateToDto(row));
  }

  async setPayRate(
    tutorId: string,
    dto: SetPayRateDto,
  ): Promise<TutorPayRateDto> {
    const id = await this.repo.setPayRate({
      tutorId,
      payBasis: dto.payBasis,
      amountCents: dto.amountCents,
      effectiveFrom: dto.effectiveFrom,
    });
    const row = await this.repo.getPayRateById(id);
    if (!row) throw new Error('Freshly set pay rate could not be re-read');
    return TutorsMapper.payRateToDto(row);
  }
}
