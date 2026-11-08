import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { EnquiryRow } from './rows/enquiry.row.js';

const ENQUIRY_COLUMNS =
  'id, full_name, email, phone, topic, message, source, status, handled_by, handled_at, converted_learner_id, created_at';

/**
 * Plain table reads/writes — no dedicated function exists (confirmed by
 * grep). `submit`'s INSERT deliberately omits `status`/`handled_by`/
 * `converted_learner_id` entirely rather than passing them explicitly: the
 * table's own defaults (`'new'`/`null`/`null`) are exactly what the RLS
 * INSERT policy's `WITH CHECK` requires, for both `anon` and `authenticated`
 * callers — no special-casing needed for either.
 *
 * `submit` never uses `RETURNING` — caught live, submitting as a genuinely
 * anonymous actor (no JWT, not merely "authenticated but non-admin"):
 * Postgres's `RETURNING` clause requires the row to also be visible under
 * the table's own SELECT policies, and `anon` has none here ("admin reads"
 * is `authenticated`-only, by design — "only admins may ever read the
 * list"). The INSERT's own `WITH CHECK` passes, but `RETURNING` then fails
 * with the same "new row violates row-level security policy" error as a
 * genuinely rejected write, even though the row was actually committed.
 * Pre-generating the id client-side and constructing the response from the
 * known input avoids ever needing that SELECT visibility.
 */
@Injectable()
export class EnquiriesRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  async submit(input: {
    fullName: string;
    email?: string;
    phone?: string;
    topic?: string;
    message: string;
    source?: string;
  }): Promise<EnquiryRow> {
    const id = randomUUID();
    const createdAt = new Date();
    await this.sp.executeRaw(
      `insert into public.contact_enquiries (id, full_name, email, phone, topic, message, source, created_at)
       values ($1, $2, coalesce($3, ''), coalesce($4, ''), coalesce($5, ''), $6, coalesce($7, 'website'), $8)`,
      [
        id,
        input.fullName,
        input.email ?? null,
        input.phone ?? null,
        input.topic ?? null,
        input.message,
        input.source ?? null,
        createdAt,
      ],
    );
    return {
      id,
      full_name: input.fullName,
      email: input.email ?? '',
      phone: input.phone ?? '',
      topic: input.topic ?? '',
      message: input.message,
      source: input.source ?? 'website',
      status: 'new',
      handled_by: null,
      handled_at: null,
      converted_learner_id: null,
      created_at: createdAt,
    };
  }

  list(status?: string): Promise<EnquiryRow[]> {
    if (status) {
      return this.sp.selectMany<EnquiryRow>(
        `select ${ENQUIRY_COLUMNS} from public.contact_enquiries where status = $1 order by created_at desc`,
        [status],
      );
    }
    return this.sp.selectMany<EnquiryRow>(
      `select ${ENQUIRY_COLUMNS} from public.contact_enquiries order by created_at desc`,
    );
  }

  getById(id: string): Promise<EnquiryRow | undefined> {
    return this.sp.selectOne<EnquiryRow>(
      `select ${ENQUIRY_COLUMNS} from public.contact_enquiries where id = $1`,
      [id],
    );
  }

  async updateStatus(
    id: string,
    status: string,
    handledBy: string,
  ): Promise<EnquiryRow | undefined> {
    const result = await this.sp.executeRaw<EnquiryRow>(
      `update public.contact_enquiries set status = $2, handled_by = $3, handled_at = now()
       where id = $1
       returning ${ENQUIRY_COLUMNS}`,
      [id, status, handledBy],
    );
    return result.rows[0];
  }

  async convert(
    id: string,
    learnerId: string,
    handledBy: string,
  ): Promise<EnquiryRow | undefined> {
    const result = await this.sp.executeRaw<EnquiryRow>(
      `update public.contact_enquiries
       set status = 'enrolled', converted_learner_id = $2, handled_by = $3,
           handled_at = coalesce(handled_at, now())
       where id = $1
       returning ${ENQUIRY_COLUMNS}`,
      [id, learnerId, handledBy],
    );
    return result.rows[0];
  }
}
