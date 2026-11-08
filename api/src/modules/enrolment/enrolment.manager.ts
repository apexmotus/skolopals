import { Injectable, NotFoundException } from '@nestjs/common';
import { PagedResult } from '../../common/types/paged-result.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import type {
  ActivateEnrolmentDto,
  ActivateEnrolmentResultDto,
} from './dto/activate-enrolment.dto.js';
import type { EnrolmentDto, ListEnrolmentsQueryDto } from './dto/enrolment.dto.js';
import type { SubmitEnrolmentDto } from './dto/submit-enrolment.dto.js';
import type {
  EnrolmentSubjectDto,
  UpdateEnrolmentSubjectsDto,
} from './dto/update-enrolment-subjects.dto.js';
import { EnrolmentMapper } from './enrolment.mapper.js';
import { EnrolmentRepository } from './enrolment.repository.js';

@Injectable()
export class EnrolmentManager {
  constructor(
    private readonly repo: EnrolmentRepository,
    private readonly uow: UnitOfWork,
  ) {}

  /** `public.submit_enrolment` runs as the signed-in guardian (`auth.uid()` inside the function) — the actor isn't passed as a parameter, RLS/the function's own check does the "only a parent or guardian" gate. */
  async submit(
    _actor: AuthUser,
    dto: SubmitEnrolmentDto,
  ): Promise<EnrolmentDto> {
    const payload = EnrolmentMapper.toSubmitPayload(dto);
    const id = await this.repo.submit(payload);
    const row = await this.repo.getById(id);
    if (!row)
      throw new Error('Freshly submitted enrolment could not be re-read');
    return EnrolmentMapper.toDto(row);
  }

  /** RLS ("enrolments: read if permitted") already scopes this to the learner's guardian, the assigned tutor, or admin — an unentitled actor's select simply returns nothing, mapped to 404 here. */
  async getById(id: string): Promise<EnrolmentDto> {
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException('Enrolment not found.');
    return EnrolmentMapper.toDto(row);
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

  /**
   * `public.activate_enrolment` already allocates the registration
   * invoice's number internally — no `BillingManager`/`BillingRepository`
   * dependency exists or is needed here (see `EnrolmentRepository`'s class
   * doc for why 08-phase3b's assumed cross-module dependency doesn't apply).
   */
  async activate(
    id: string,
    dto: ActivateEnrolmentDto,
  ): Promise<ActivateEnrolmentResultDto> {
    const invoiceId = await this.repo.activate({
      enrolmentId: id,
      assignedTutorId: dto.assignedTutorId,
      startDate: dto.startDate,
      firstMonthCents: dto.firstMonthCents,
      reason: dto.reason,
    });
    return { enrolmentId: id, registrationInvoiceId: invoiceId ?? undefined };
  }

  async decline(id: string): Promise<EnrolmentDto> {
    const row = await this.repo.decline(id);
    if (!row)
      throw new NotFoundException('Enrolment not found, or not pending.');
    return EnrolmentMapper.toDto(row);
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
}
