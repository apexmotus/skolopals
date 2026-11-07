import { Injectable } from '@nestjs/common';
import { StoredProcRunner } from '../../database/stored-proc.runner';
import type { ConsentRow } from './rows/consent.row';
import type { RetentionDueRow, RetentionLogRow } from './rows/retention.row';

const CONSENT_COLUMNS =
  'id, consent_type_code, guardian_id, learner_id, granted, granted_at, withdrawn_at, policy_version';

const RETENTION_LOG_COLUMNS =
  'id, record_class, subject_id, subject_label, action, performed_at, confirmed_by, note';

/**
 * No dedicated function for any of this (confirmed by grep: only
 * `has_required_consents`/`check_enrolment_consents` exist, both called
 * internally by the enrolment trigger, never from here). `consents.learner_id`
 * is nullable (a guardian-level consent, not tied to one child) but every
 * endpoint this module exposes only ever reaches a row through a specific
 * `learner_id`, so that case never surfaces here.
 */
@Injectable()
export class ConsentRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  /** `private.is_guardian_of`/`is_admin` are PUBLIC-executable by default (never revoked, unlike the write RPCs) — safe to call directly, not just inside a policy's USING clause. */
  async isEntitledToLearner(learnerId: string): Promise<boolean> {
    const row = await this.sp.selectOne<{ entitled: boolean }>(
      'select (private.is_guardian_of($1) or private.is_admin()) as entitled',
      [learnerId],
    );
    return row?.entitled ?? false;
  }

  listForLearner(learnerId: string): Promise<ConsentRow[]> {
    return this.sp.selectMany<ConsentRow>(
      `select ${CONSENT_COLUMNS} from public.consents where learner_id = $1 order by granted_at`,
      [learnerId],
    );
  }

  /**
   * An UPDATE, never a DELETE or a second inserted row — the withdrawn
   * consent stays as the record that it was granted, then withdrawn.
   * Scoped to `guardian_id = $3` (the actor's own id, never trusted from a
   * body param) — matches "Guardian-who-granted", a narrower rule than the
   * list endpoint's "Guardian-of", and the same thing the RLS UPDATE policy
   * independently enforces.
   */
  async withdraw(
    learnerId: string,
    consentTypeCode: string,
    guardianId: string,
  ): Promise<ConsentRow | undefined> {
    const result = await this.sp.executeRaw<ConsentRow>(
      `update public.consents set withdrawn_at = now()
       where learner_id = $1 and consent_type_code = $2 and guardian_id = $3 and withdrawn_at is null
       returning ${CONSENT_COLUMNS}`,
      [learnerId, consentTypeCode, guardianId],
    );
    return result.rows[0];
  }

  getDueForRetention(): Promise<RetentionDueRow[]> {
    return this.sp.selectMany<RetentionDueRow>(
      'select record_class, subject_id, subject_label, left_on, retention_months, due_on from public.v_retention_due order by due_on',
    );
  }

  /**
   * Always `record_class = 'learner_records'`, matching `v_retention_due`'s
   * own hard-coded scope and this endpoint's `:learnerId` path — this is
   * not a generic "any record class" logger. Writes, never deletes:
   * nothing here, or anywhere else in this schema, performs the actual
   * purge — see the module's own doc comment.
   */
  async recordLearnerRetentionAction(input: {
    learnerId: string;
    action: string;
    confirmedBy: string;
    note?: string;
  }): Promise<RetentionLogRow> {
    const result = await this.sp.executeRaw<RetentionLogRow>(
      `insert into public.data_retention_log (record_class, subject_id, subject_label, action, confirmed_by, note)
       select 'learner_records', $1, coalesce((select full_name from public.learners where id = $1), ''), $2, $3, coalesce($4, '')
       returning ${RETENTION_LOG_COLUMNS}`,
      [input.learnerId, input.action, input.confirmedBy, input.note ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }
}
