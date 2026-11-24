import { Injectable, NotFoundException } from '@nestjs/common';
import { STORAGE_BUCKETS } from '../../common/file-storage/file-storage.constants.js';
import { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import { PagedResult } from '../../common/types/paged-result.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import type {
  ActivateEnrolmentDto,
  ActivateEnrolmentResultDto,
} from './dto/activate-enrolment.dto.js';
import type {
  AcceptEnrolmentResultDto,
  DeclineEnrolmentDto,
  EnrolmentProgressDto,
  QuoteDto,
  QuoteQueryDto,
  ReportCardFiledDto,
} from './dto/application.dto.js';
import type { EnrolmentDto, ListEnrolmentsQueryDto } from './dto/enrolment.dto.js';
import type { ReportCardUploadDto, SubmitEnrolmentDto } from './dto/submit-enrolment.dto.js';
import type {
  EnrolmentSubjectDto,
  UpdateEnrolmentSubjectsDto,
} from './dto/update-enrolment-subjects.dto.js';
import { EnrolmentMapper } from './enrolment.mapper.js';
import { EnrolmentRepository, type FiledDocument } from './enrolment.repository.js';

@Injectable()
export class EnrolmentManager {
  constructor(
    private readonly repo: EnrolmentRepository,
    private readonly uow: UnitOfWork,
    private readonly storage: FileStorageService,
  ) {}

  /**
   * `private.submit_enrolment` runs as the signed-in guardian (`auth.uid()`
   * inside the function) and checks the report card is the caller's own
   * staging upload. The file is moved under the learner inside the same unit
   * of work, so a failed move rolls the application back rather than leaving
   * a learner whose report card points at nothing.
   */
  async submit(
    _actor: AuthUser,
    dto: SubmitEnrolmentDto,
  ): Promise<EnrolmentDto> {
    const payload = EnrolmentMapper.toSubmitPayload(dto);
    const submitted = await this.uow.run(async () => {
      const result = await this.repo.submit(payload);
      await this.file(result.reportCard);
      return result;
    });
    const row = await this.repo.getById(submitted.enrolmentId);
    if (!row)
      throw new Error('Freshly submitted enrolment could not be re-read');
    return EnrolmentMapper.toDto(row);
  }

  /** The guardian while the application waits for review, or an administrator. */
  replaceReportCard(
    enrolmentId: string,
    dto: ReportCardUploadDto,
  ): Promise<ReportCardFiledDto> {
    return this.uow.run(async () => {
      const filed = await this.repo.replaceReportCard(
        enrolmentId,
        EnrolmentMapper.toReportCardPayload(dto),
      );
      await this.file(filed);
      return { documentId: filed.documentId };
    });
  }

  /** RLS ("enrolments: read if permitted") already scopes this to the learner's guardian, the assigned tutor, or admin — an unentitled actor's select simply returns nothing, mapped to 404 here. */
  async getById(id: string): Promise<EnrolmentDto> {
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException('Enrolment not found.');
    return EnrolmentMapper.toDto(row);
  }

  async progress(id: string): Promise<EnrolmentProgressDto> {
    const row = await this.repo.getProgress(id);
    if (!row) throw new NotFoundException('Enrolment not found.');
    return EnrolmentMapper.progressToDto(row);
  }

  async list(
    query: ListEnrolmentsQueryDto,
  ): Promise<PagedResult<EnrolmentDto>> {
    const { rows, totalCount } = await this.repo.list({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
    return new PagedResult(
      rows.map((row) => EnrolmentMapper.toDto(row)),
      query.page,
      query.pageSize,
      totalCount,
    );
  }

  quote(query: QuoteQueryDto): Promise<QuoteDto> {
    return this.repo.quote(query.packageCode, query.on, query.learnerId);
  }

  /** Raises the pre-paid offer invoice; refused without a finished aptitude test and a report card (D15). */
  accept(id: string): Promise<AcceptEnrolmentResultDto> {
    return this.repo.accept(id);
  }

  async decline(id: string, dto: DeclineEnrolmentDto): Promise<EnrolmentDto> {
    await this.repo.decline(id, dto.reason, dto.message);
    return this.getById(id);
  }

  async activate(
    id: string,
    dto: ActivateEnrolmentDto,
  ): Promise<ActivateEnrolmentResultDto> {
    await this.repo.activate(id, dto.assignedTutorId);
    return { enrolmentId: id };
  }

  /** Clear + insert inside one transaction — the subject-allowance check is a DEFERRED constraint trigger that must see the FINAL row set at COMMIT, not fire once per individual insert. */
  async updateSubjects(
    id: string,
    dto: UpdateEnrolmentSubjectsDto,
  ): Promise<EnrolmentSubjectDto[]> {
    await this.uow.run(async () => {
      await this.repo.clearSubjects(id);
      await this.repo.insertSubjects(id, dto.subjects);
    });
    const rows = await this.repo.listSubjects(id);
    return rows.map((row) => EnrolmentMapper.subjectToDto(row));
  }

  private file(doc: FiledDocument): Promise<void> {
    return this.storage.move(
      STORAGE_BUCKETS.learnerDocuments,
      doc.stagingPath,
      doc.storagePath,
    );
  }
}
