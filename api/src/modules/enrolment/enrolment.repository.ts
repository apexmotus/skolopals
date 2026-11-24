import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param.js';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { EnrolmentRow, EnrolmentSubjectRow } from './rows/enrolment.row.js';
import type {
  AcceptEnrolmentResultDto,
  QuoteDto,
} from './dto/application.dto.js';

/** Where the API must move a report card once its row exists. */
export interface FiledDocument {
  documentId: string;
  stagingPath: string;
  storagePath: string;
}

export interface SubmittedEnrolment {
  enrolmentId: string;
  learnerId: string;
  reportCard: FiledDocument;
}

export interface ProgressRow {
  enrolment_id: string;
  learner_id: string;
  status: string;
  stage: string;
  offer_expires_on: string | null;
  offer_invoice_id: string | null;
  offer_balance_cents: number | null;
  open_submission_id: string | null;
  submission_status: string | null;
  decline_reason: string | null;
}

const ENROLMENT_COLUMNS =
  'id, learner_id, package_code, status, preferred_tutor_id, assigned_tutor_id, start_date, end_date, ' +
  'first_month_amount_cents, first_month_reason, source, created_at, activated_at';

const PROGRESS_COLUMNS =
  'enrolment_id, learner_id, status, stage, offer_expires_on, offer_invoice_id, offer_balance_cents, ' +
  'open_submission_id, submission_status, decline_reason';

export interface SubmitEnrolmentPayload {
  learner: Record<string, unknown>;
  packageCode: string;
  subjects: Record<string, unknown>[];
  emergencyContacts: Record<string, unknown>[];
  collectors: Record<string, unknown>[];
  consents: Record<string, unknown>[];
  policyVersion: string;
  preferredTutorId?: string;
  reportCard: Record<string, unknown>;
}

interface ListFilter {
  page: number;
  pageSize: number;
  status?: string;
}

/**
 * The application lifecycle lives in Postgres functions
 * (`db/migrations/20261125000001_learner_documents.sql`,
 * `20261125000002_prepaid_applications.sql`): every consent, report-card,
 * aptitude, pre-paid and pro-rata rule is enforced there, so this Repository
 * only assembles parameters and calls through.
 *
 * `private.submit_enrolment` and `private.replace_report_card` take a storage
 * path, so they are in the `private` schema (not exposed by PostgREST) and
 * reachable from this API only. They return where the caller must move the
 * uploaded file; the Manager does the move.
 */
@Injectable()
export class EnrolmentRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  private async jsonb<T>(fn: string, params: Parameters<StoredProcRunner['queryOne']>[1]): Promise<T> {
    const name = fn.slice(fn.indexOf('.') + 1);
    const row = await this.sp.queryOne<Record<string, T>>(fn, params);
    if (!row) throw new Error(`${fn} unexpectedly returned no row`);
    return row[name] as T;
  }

  submit(payload: SubmitEnrolmentPayload): Promise<SubmittedEnrolment> {
    return this.jsonb('private.submit_enrolment', [
      p.jsonb('p_learner', payload.learner),
      p.text('p_package_code', payload.packageCode),
      p.jsonb('p_subjects', payload.subjects),
      p.jsonb('p_emergency', payload.emergencyContacts),
      p.jsonb('p_collectors', payload.collectors),
      p.jsonb('p_consents', payload.consents),
      p.text('p_policy_version', payload.policyVersion),
      p.jsonb('p_report_card', payload.reportCard),
      p.uuid('p_preferred_tutor', payload.preferredTutorId ?? null),
    ]);
  }

  replaceReportCard(
    enrolmentId: string,
    reportCard: Record<string, unknown>,
  ): Promise<FiledDocument> {
    return this.jsonb('private.replace_report_card', [
      p.uuid('p_enrolment_id', enrolmentId),
      p.jsonb('p_report_card', reportCard),
    ]);
  }

  getById(id: string): Promise<EnrolmentRow | undefined> {
    return this.sp.selectOne<EnrolmentRow>(
      `select ${ENROLMENT_COLUMNS} from public.enrolments where id = $1`,
      [id],
    );
  }

  getProgress(id: string): Promise<ProgressRow | undefined> {
    return this.sp.selectOne<ProgressRow>(
      `select ${PROGRESS_COLUMNS} from public.v_enrolment_progress where enrolment_id = $1`,
      [id],
    );
  }

  async list(
    filter: ListFilter,
  ): Promise<{ rows: EnrolmentRow[]; totalCount: number }> {
    const values: unknown[] = [];
    let whereClause = '';
    if (filter.status) {
      values.push(filter.status);
      whereClause = `where status = $${values.length}`;
    }
    values.push(filter.pageSize, (filter.page - 1) * filter.pageSize);

    const result = await this.sp.executeRaw<
      EnrolmentRow & { total_count: string }
    >(
      `select ${ENROLMENT_COLUMNS}, count(*) over() as total_count
       from public.enrolments
       ${whereClause}
       order by created_at desc
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    const firstRow = result.rows[0];
    return {
      rows: result.rows,
      totalCount: firstRow ? Number(firstRow.total_count) : 0,
    };
  }

  quote(packageCode: string, on?: string, learnerId?: string): Promise<QuoteDto> {
    const params = [p.text('p_package_code', packageCode)];
    if (on) params.push(p.date('p_on', on));
    if (learnerId) params.push(p.uuid('p_learner_id', learnerId));
    return this.jsonb('public.enrolment_quote', params);
  }

  accept(enrolmentId: string): Promise<AcceptEnrolmentResultDto> {
    return this.jsonb('public.accept_enrolment', [
      p.uuid('p_enrolment_id', enrolmentId),
    ]);
  }

  async decline(enrolmentId: string, reason: string, message?: string): Promise<void> {
    await this.sp.queryOne('public.decline_enrolment', [
      p.uuid('p_enrolment_id', enrolmentId),
      p.text('p_reason', reason),
      p.text('p_message', message ?? null),
    ]);
  }

  /** Refused by the function unless the application is accepted and its offer invoice is paid. */
  async activate(enrolmentId: string, assignedTutorId?: string): Promise<void> {
    await this.sp.queryOne('public.activate_enrolment', [
      p.uuid('p_enrolment_id', enrolmentId),
      p.uuid('p_assigned_tutor_id', assignedTutorId ?? null),
    ]);
  }

  listSubjects(enrolmentId: string): Promise<EnrolmentSubjectRow[]> {
    return this.sp.selectMany<EnrolmentSubjectRow>(
      'select enrolment_id, subject_code, preferred_language_code from public.enrolment_subjects where enrolment_id = $1 order by subject_code',
      [enrolmentId],
    );
  }

  async clearSubjects(enrolmentId: string): Promise<void> {
    await this.sp.executeRaw(
      'delete from public.enrolment_subjects where enrolment_id = $1',
      [enrolmentId],
    );
  }

  async insertSubjects(
    enrolmentId: string,
    subjects: { subjectCode: string; preferredLanguageCode?: string }[],
  ): Promise<void> {
    for (const subject of subjects) {
      await this.sp.executeRaw(
        'insert into public.enrolment_subjects (enrolment_id, subject_code, preferred_language_code) values ($1, $2, $3)',
        [
          enrolmentId,
          subject.subjectCode,
          subject.preferredLanguageCode ?? null,
        ],
      );
    }
  }
}
