import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception.js';
import { STORAGE_BUCKETS } from '../../common/file-storage/file-storage.constants.js';
import { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import type {
  ApproveApplicationResultDto,
  ListApplicationsQueryDto,
  PoliceClearanceUploadDto,
  RecruitmentRoundDto,
  RecruitmentSettingsDto,
  RecruitmentStatusDto,
  RetentionDueDto,
  SubmitTutorApplicationDto,
  SubmittedApplicationDto,
  TutorApplicationDetailDto,
  TutorApplicationSummaryDto,
} from './dto/tutor-application.dto.js';
import {
  type ApplicationListRow,
  type FiledMove,
  type OwnApplicationRow,
  type RecruitmentSettings,
  TutorApplicationsRepository,
} from './tutor-applications.repository.js';

/** Long enough to look through an application's documents without the links expiring mid-review. */
const DOCUMENT_LINK_TTL_SECONDS = 300;

/**
 * A South African number in the form the database stores (+27XXXXXXXXX), from
 * what people type: 072 123 4567, 0721234567, 27721234567, +27 72 123 4567.
 */
export function normaliseSaPhone(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, '');
  if (/^0[1-9]\d{8}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^27[1-9]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^\+27[1-9]\d{8}$/.test(digits)) return digits;
  return null;
}

/** WhatsApp may be a foreign number; a local one is normalised like any other. */
export function normaliseWhatsApp(raw: string): string | null {
  const local = normaliseSaPhone(raw);
  if (local) return local;
  const digits = raw.replace(/[\s()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** "Mathematics 6–7 · English R, 2–3" from grade names in order ("Grade 6", "Grade R"). */
export function summariseSubjects(subjects: ApplicationListRow['subjects']): string {
  return subjects
    .map(({ subject, grades }) => {
      const runs: { first: string; last: string; order: number }[] = [];
      for (const g of grades) {
        const label = g.name.replace(/^Grade\s+/i, '');
        const run = runs.at(-1);
        if (run && g.order === run.order + 1) {
          run.last = label;
          run.order = g.order;
        } else {
          runs.push({ first: label, last: label, order: g.order });
        }
      }
      return `${subject} ${runs.map((r) => (r.first === r.last ? r.first : `${r.first}–${r.last}`)).join(', ')}`;
    })
    .join(' · ');
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

@Injectable()
export class TutorApplicationsManager {
  constructor(
    private readonly repo: TutorApplicationsRepository,
    private readonly uow: UnitOfWork,
    private readonly storage: FileStorageService,
  ) {}

  // Recruitment ------------------------------------------------------------------

  status(): Promise<RecruitmentStatusDto> {
    return this.repo.status();
  }

  async rounds(): Promise<RecruitmentRoundDto[]> {
    const rows = await this.repo.listRounds();
    return rows.map((r) => ({
      id: r.id,
      openedAt: r.opened_at.toISOString(),
      closesAt: iso(r.closes_at),
      closedAt: iso(r.closed_at),
      message: r.message,
      policeClearanceRequired: r.police_clearance_required,
      isOpen: r.is_open,
      needs: r.needs,
      applicationCount: Number(r.application_count),
    }));
  }

  async open(dto: RecruitmentSettingsDto): Promise<RecruitmentStatusDto> {
    await this.repo.open(this.settings(dto));
    return this.repo.status();
  }

  async update(dto: RecruitmentSettingsDto): Promise<RecruitmentStatusDto> {
    await this.repo.update(this.settings(dto));
    return this.repo.status();
  }

  async close(): Promise<RecruitmentStatusDto> {
    await this.repo.close();
    return this.repo.status();
  }

  private settings(dto: RecruitmentSettingsDto): RecruitmentSettings {
    return {
      closesAt: dto.closesAt ?? null,
      message: dto.message?.trim() ?? '',
      needs: dto.needs ?? [],
      policeClearanceRequired: dto.policeClearanceRequired ?? false,
    };
  }

  // Applicant ----------------------------------------------------------------------

  /**
   * Records the application, then moves every staged file under
   * `applications/<id>/`, in one unit of work: a failed move rolls the
   * application back rather than leaving documents that point at nothing.
   */
  async submit(dto: SubmitTutorApplicationDto): Promise<SubmittedApplicationDto> {
    const phone = normaliseSaPhone(dto.phone);
    if (!phone)
      throw new BusinessRuleException('INVALID_PHONE', 'Enter a South African phone number, for example 072 123 4567.');
    const whatsapp = dto.whatsappNumber?.trim() ? normaliseWhatsApp(dto.whatsappNumber) : phone;
    if (!whatsapp)
      throw new BusinessRuleException(
        'INVALID_WHATSAPP',
        'Enter your WhatsApp number, for example 072 123 4567, or +44 7700 900123 for a number outside South Africa.',
      );

    const payload = {
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      phone,
      whatsappNumber: whatsapp,
      address: {
        line1: dto.address.line1,
        line2: dto.address.line2 ?? '',
        city: dto.address.city,
        province: dto.address.province,
        country: dto.address.country?.trim() ? dto.address.country.trim() : 'South Africa',
      },
      // One row per grade, as tutor_competencies stores them.
      competencies: dto.competencies.flatMap((c) =>
        [...new Set(c.gradeCodes)].map((gradeCode) => ({
          subjectCode: c.subjectCode,
          gradeCode,
          languageCodes: [...new Set(c.languageCodes)],
        })),
      ),
      documents: dto.documents.map((d) => ({
        docType: d.docType,
        stagingPath: d.path,
        mime: d.mimeType,
        sizeBytes: d.sizeBytes,
        originalName: d.originalName ?? '',
        title: d.title ?? '',
        institution: d.institution ?? '',
        yearAwarded: d.yearAwarded ?? null,
      })),
      references: dto.references.map((r) => ({
        fullName: r.fullName,
        relationship: r.relationship,
        phone: r.phone,
        email: r.email ?? '',
      })),
      consents: {
        popia: dto.consents.popia,
        referencesAgreed: dto.consents.referencesAgreed,
        declaration: dto.consents.declaration,
      },
    };

    const phones = payload.references.map((r) => r.phone.replace(/\D/g, ''));
    if (new Set(phones).size !== phones.length)
      throw new BusinessRuleException('DUPLICATE_REFERENCE', 'Each reference needs a different phone number.');

    return this.uow.run(async () => {
      const result = await this.repo.submit(payload);
      await this.file(result.documents);
      return { applicationId: result.applicationId };
    });
  }

  /** The caller's latest application, or null. `/teach` decides from this and the round whether to show the form. */
  async mine(actor: AuthUser): Promise<OwnApplication | null> {
    const row = await this.repo.latestOwn(actor.id);
    return row ? toOwn(row) : null;
  }

  withdraw(applicationId: string): Promise<void> {
    return this.repo.withdraw(applicationId);
  }

  /** From an applicant under review or a tutor after approval; the database decides which. */
  async addPoliceClearance(dto: PoliceClearanceUploadDto): Promise<void> {
    await this.uow.run(async () => {
      const move = await this.repo.addPoliceClearance({
        stagingPath: dto.path,
        mime: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        originalName: dto.originalName ?? '',
      });
      await this.file([move]);
    });
  }

  private async file(moves: FiledMove[]): Promise<void> {
    for (const m of moves) await this.storage.move(STORAGE_BUCKETS.tutorDocuments, m.stagingPath, m.storagePath);
  }

  // Review ---------------------------------------------------------------------------

  async list(query: ListApplicationsQueryDto): Promise<TutorApplicationSummaryDto[]> {
    const rows = await this.repo.list(query.status ?? null, query.roundId ?? null);
    return rows.map(toSummary);
  }

  async detail(applicationId: string): Promise<TutorApplicationDetailDto> {
    const [row] = await this.repo.list(null, null, applicationId);
    if (!row) throw new NotFoundException('Application not found.');
    const [competencies, documents, references] = await Promise.all([
      this.repo.listCompetencies(applicationId),
      this.repo.listDocuments(applicationId),
      this.repo.listReferences(applicationId),
    ]);
    const urls = await Promise.all(
      documents.map((d) =>
        this.storage.createDownloadUrl(STORAGE_BUCKETS.tutorDocuments, d.storage_path, DOCUMENT_LINK_TTL_SECONDS),
      ),
    );
    return Object.assign(toSummary(row), {
      addressLine1: row.address_line_1,
      addressLine2: row.address_line_2,
      city: row.city,
      province: row.province,
      country: row.country,
      decisionNote: row.decision_note,
      reviewedAt: iso(row.reviewed_at),
      competencies: competencies.map((c) => ({
        subjectCode: c.subject_code,
        subjectName: c.subject_name,
        gradeCode: c.grade_code,
        gradeName: c.grade_name,
        languages: c.languages,
      })),
      documents: documents.map((d, i) => ({
        id: d.id,
        docType: d.doc_type,
        originalName: d.original_name,
        mimeType: d.mime_type,
        sizeBytes: d.size_bytes,
        title: d.title,
        institution: d.institution,
        yearAwarded: d.year_awarded,
        uploadedAt: d.uploaded_at.toISOString(),
        url: urls[i],
      })),
      references: references.map((r) => ({
        position: r.position,
        fullName: r.full_name,
        relationship: r.relationship,
        phone: r.phone,
        email: r.email,
      })),
    });
  }

  setStatus(applicationId: string, status: 'shortlisted' | 'rejected', note?: string): Promise<void> {
    return this.repo.setStatus(applicationId, status, note?.trim() ?? null);
  }

  markIdentityChecked(applicationId: string): Promise<void> {
    return this.repo.markIdentityChecked(applicationId);
  }

  approve(applicationId: string): Promise<ApproveApplicationResultDto> {
    return this.repo.approve(applicationId);
  }

  requestPoliceClearance(target: { applicationId?: string; tutorId?: string }, note?: string): Promise<void> {
    return this.repo.requestPoliceClearance(target, note?.trim() ?? null);
  }

  // Retention (SPEC D8) --------------------------------------------------------------

  async retentionDue(): Promise<RetentionDueDto[]> {
    const rows = await this.repo.listRetentionDue();
    return rows.map((r) => ({
      applicationId: r.application_id,
      name: `${r.first_name} ${r.last_name}`,
      status: r.status,
      decidedAt: r.decided_at.toISOString(),
      dueOn: typeof r.due_on === 'string' ? r.due_on : r.due_on.toISOString().slice(0, 10),
    }));
  }

  /**
   * Deletes the application's rows (logged in data_retention_log), then its
   * files, in one unit of work: if the files cannot be removed the rows come
   * back, so the application stays on the due list to try again rather than
   * leaving an ID photo in storage that nothing points to.
   */
  async purge(applicationId: string): Promise<{ deletedFiles: number }> {
    return this.uow.run(async () => {
      const { storagePaths } = await this.repo.purge(applicationId);
      if (storagePaths.length > 0) await this.storage.remove(STORAGE_BUCKETS.tutorDocuments, storagePaths);
      return { deletedFiles: storagePaths.length };
    });
  }
}

export interface OwnApplication {
  id: string;
  roundId: string;
  status: string;
  submittedAt: string;
  policeClearanceRequired: boolean;
  policeClearanceRequestedAt: string | null;
  policeClearanceRequestNote: string;
  hasPoliceClearance: boolean;
}

function toOwn(r: OwnApplicationRow): OwnApplication {
  return {
    id: r.id,
    roundId: r.round_id,
    status: r.status,
    submittedAt: r.submitted_at.toISOString(),
    policeClearanceRequired: r.police_clearance_required,
    policeClearanceRequestedAt: iso(r.police_clearance_requested_at),
    policeClearanceRequestNote: r.police_clearance_request_note,
    hasPoliceClearance: r.has_police_clearance,
  };
}

function toSummary(r: ApplicationListRow): TutorApplicationSummaryDto {
  return {
    id: r.id,
    roundId: r.round_id,
    applicantId: r.applicant_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    whatsappNumber: r.whatsapp_number,
    status: r.status,
    submittedAt: r.submitted_at.toISOString(),
    policeClearanceRequired: r.police_clearance_required,
    policeClearanceRequestedAt: iso(r.police_clearance_requested_at),
    policeClearanceRequestNote: r.police_clearance_request_note,
    hasPoliceClearance: r.has_police_clearance,
    identityCheckedAt: iso(r.identity_checked_at),
    tutorId: r.tutor_id,
    subjectsSummary: summariseSubjects(r.subjects),
  };
}
