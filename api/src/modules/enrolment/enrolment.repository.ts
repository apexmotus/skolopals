import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param';
import { StoredProcRunner } from '../../database/stored-proc.runner';
import type { EnrolmentRow, EnrolmentSubjectRow } from './rows/enrolment.row';

const ENROLMENT_COLUMNS =
  'id, learner_id, package_code, status, preferred_tutor_id, assigned_tutor_id, start_date, end_date, ' +
  'first_month_amount_cents, first_month_reason, source, created_at, activated_at';

export interface SubmitEnrolmentPayload {
  learner: Record<string, unknown>;
  packageCode: string;
  subjects: Record<string, unknown>[];
  emergencyContacts: Record<string, unknown>[];
  collectors: Record<string, unknown>[];
  consents: Record<string, unknown>[];
  policyVersion: string;
  preferredTutorId?: string;
}

interface ListFilter {
  page: number;
  pageSize: number;
  status?: string;
}

/**
 * `submit_enrolment`/`activate_enrolment` are the existing all-or-nothing
 * Postgres functions this schema was built around
 * (`db/migrations/20261020000016_enrolment_rpcs.sql`) — every consent/
 * billing-contact/subject-allowance/registration-fee-once rule lives
 * **inside** them (plus a defence-in-depth trigger on `enrolments` itself),
 * so this Repository never re-implements that logic, only assembles the
 * jsonb payloads and calls through.
 *
 * `activate_enrolment` already allocates the registration invoice's number
 * internally (`private.next_invoice_number`, called from inside the
 * function) — contrary to 08-phase3b's assumption that this API would need
 * to call a separate billing-module invoice-numbering step, there is no
 * cross-module Manager dependency to resolve here at all. `EnrolmentManager`
 * never touches a `BillingManager`/`BillingRepository`.
 */
@Injectable()
export class EnrolmentRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  async submit(payload: SubmitEnrolmentPayload): Promise<string> {
    const row = await this.sp.queryOne<{ submit_enrolment: string }>(
      'public.submit_enrolment',
      [
        p.jsonb('p_learner', payload.learner),
        p.text('p_package_code', payload.packageCode),
        p.jsonb('p_subjects', payload.subjects),
        p.jsonb('p_emergency', payload.emergencyContacts),
        p.jsonb('p_collectors', payload.collectors),
        p.jsonb('p_consents', payload.consents),
        p.text('p_policy_version', payload.policyVersion),
        p.uuid('p_preferred_tutor', payload.preferredTutorId ?? null),
      ],
    );
    if (!row) throw new Error('submit_enrolment unexpectedly returned no row');
    return row.submit_enrolment;
  }

  getById(id: string): Promise<EnrolmentRow | undefined> {
    return this.sp.selectOne<EnrolmentRow>(
      `select ${ENROLMENT_COLUMNS} from public.enrolments where id = $1`,
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

  /**
   * Returns `{ enrolmentId, invoiceId }` — `invoiceId` is `null` when this
   * learner was already charged a registration fee before (the function
   * itself never sets its `v_invoice` local in that branch, so it returns
   * SQL `NULL`, not a real id — never assume this is always populated).
   */
  async activate(input: {
    enrolmentId: string;
    assignedTutorId: string;
    startDate?: string;
    firstMonthCents?: number;
    reason?: string;
  }): Promise<string | null> {
    const params = [
      p.uuid('p_enrolment_id', input.enrolmentId),
      p.uuid('p_assigned_tutor_id', input.assignedTutorId),
    ];
    if (input.startDate) params.push(p.date('p_start_date', input.startDate));
    if (input.firstMonthCents !== undefined)
      params.push(p.int('p_first_month_cents', input.firstMonthCents));
    if (input.reason) params.push(p.text('p_reason', input.reason));

    const row = await this.sp.queryOne<{ activate_enrolment: string | null }>(
      'public.activate_enrolment',
      params,
    );
    if (!row)
      throw new Error('activate_enrolment unexpectedly returned no row');
    return row.activate_enrolment;
  }

  async decline(id: string): Promise<EnrolmentRow | undefined> {
    const result = await this.sp.executeRaw<EnrolmentRow>(
      `update public.enrolments set status = 'declined'
       where id = $1 and status = 'pending'
       returning ${ENROLMENT_COLUMNS}`,
      [id],
    );
    return result.rows[0];
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
