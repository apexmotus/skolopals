import { Injectable } from '@nestjs/common';
import { StoredProcRunner } from '../../database/stored-proc.runner';
import type { AuthorisedCollectorRow } from './rows/authorised-collector.row';
import type { EmergencyContactRow } from './rows/emergency-contact.row';
import type { LearnerGuardianRow } from './rows/learner-guardian.row';
import type { LearnerRow } from './rows/learner.row';
import type { MedicalNotesRow } from './rows/medical-notes.row';
import type { ProfileRow } from './rows/profile.row';

interface ListLearnersFilter {
  page: number;
  pageSize: number;
  search?: string;
  gradeCode?: string;
  status?: string;
}

/**
 * `can_view_learner`/`can_view_learner_private` call the existing Postgres
 * helper functions directly (`db/migrations/20261020000008_rls.sql`) rather
 * than re-implementing the join logic — same source of truth RLS itself
 * uses, zero drift risk. Proven against the real schema by
 * `scripts/people-rls-spike.ts` before this repository was written (per
 * 07-phase3a-reference-people-tutors.md task 2).
 */
@Injectable()
export class PeopleRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  canViewLearner(learnerId: string): Promise<boolean> {
    return this.checkPermission(
      'select private.can_view_learner($1) as allowed',
      learnerId,
    );
  }

  canViewLearnerPrivate(learnerId: string): Promise<boolean> {
    return this.checkPermission(
      'select private.can_view_learner_private($1) as allowed',
      learnerId,
    );
  }

  private async checkPermission(
    sql: string,
    learnerId: string,
  ): Promise<boolean> {
    const row = await this.sp.selectOne<{ allowed: boolean }>(sql, [learnerId]);
    return row?.allowed ?? false;
  }

  getProfileById(id: string): Promise<ProfileRow | undefined> {
    return this.sp.selectOne<ProfileRow>(
      'select id, full_name, phone, created_at from public.profiles where id = $1',
      [id],
    );
  }

  async updateProfile(
    id: string,
    input: { fullName?: string; phone?: string },
  ): Promise<ProfileRow> {
    const result = await this.sp.executeRaw<ProfileRow>(
      `update public.profiles
       set full_name = coalesce($2, full_name), phone = coalesce($3, phone)
       where id = $1
       returning id, full_name, phone, created_at`,
      [id, input.fullName ?? null, input.phone ?? null],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('UPDATE ... RETURNING unexpectedly returned no row');
    return row;
  }

  getLearnerById(id: string): Promise<LearnerRow | undefined> {
    return this.sp.selectOne<LearnerRow>(
      `select id, profile_id, full_name, date_of_birth, grade_code, school_name, home_language_code, status,
              joined_on, left_on, created_at
       from public.learners where id = $1`,
      [id],
    );
  }

  async listLearners(
    filter: ListLearnersFilter,
  ): Promise<{ rows: LearnerRow[]; totalCount: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter.search) {
      values.push(`%${filter.search}%`);
      conditions.push(`full_name ilike $${values.length}`);
    }
    if (filter.gradeCode) {
      values.push(filter.gradeCode);
      conditions.push(`grade_code = $${values.length}`);
    }
    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status = $${values.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    values.push(filter.pageSize, (filter.page - 1) * filter.pageSize);
    const limitOffset = `limit $${values.length - 1} offset $${values.length}`;

    const result = await this.sp.executeRaw<
      LearnerRow & { total_count: string }
    >(
      `select id, profile_id, full_name, date_of_birth, grade_code, school_name, home_language_code, status,
              joined_on, left_on, created_at, count(*) over() as total_count
       from public.learners
       ${whereClause}
       order by full_name
       ${limitOffset}`,
      values,
    );
    const firstRow = result.rows[0];
    return {
      rows: result.rows,
      totalCount: firstRow ? Number(firstRow.total_count) : 0,
    };
  }

  async createLearner(input: {
    fullName: string;
    dateOfBirth: string;
    gradeCode: string;
    schoolName?: string;
    homeLanguageCode?: string;
  }): Promise<LearnerRow> {
    const result = await this.sp.executeRaw<LearnerRow>(
      `insert into public.learners (full_name, date_of_birth, grade_code, school_name, home_language_code)
       values ($1, $2, $3, coalesce($4, ''), $5)
       returning id, profile_id, full_name, date_of_birth, grade_code, school_name, home_language_code, status,
                 joined_on, left_on, created_at`,
      [
        input.fullName,
        input.dateOfBirth,
        input.gradeCode,
        input.schoolName ?? null,
        input.homeLanguageCode ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  /**
   * Takes the FULLY RESOLVED values to write (never "null means keep
   * existing") — the Manager merges the patch onto the current row first,
   * because `status`/`leftOn` move together (a CHECK constraint) and a
   * partial `coalesce`-based update can't safely express "clear leftOn".
   */
  async updateLearner(
    id: string,
    fields: {
      fullName: string;
      gradeCode: string;
      schoolName: string;
      homeLanguageCode: string | null;
      status: string;
      leftOn: string | null;
    },
  ): Promise<LearnerRow | undefined> {
    const result = await this.sp.executeRaw<LearnerRow>(
      `update public.learners
       set full_name = $2, grade_code = $3, school_name = $4, home_language_code = $5, status = $6, left_on = $7
       where id = $1
       returning id, profile_id, full_name, date_of_birth, grade_code, school_name, home_language_code, status,
                 joined_on, left_on, created_at`,
      [
        id,
        fields.fullName,
        fields.gradeCode,
        fields.schoolName,
        fields.homeLanguageCode,
        fields.status,
        fields.leftOn,
      ],
    );
    return result.rows[0];
  }

  listGuardians(learnerId: string): Promise<LearnerGuardianRow[]> {
    return this.sp.selectMany<LearnerGuardianRow>(
      `select lg.learner_id, lg.guardian_id, p.full_name as guardian_name, p.phone as guardian_phone,
              lg.relationship, lg.is_primary, lg.is_billing_contact
       from public.learner_guardians lg
       left join public.profiles p on p.id = lg.guardian_id
       where lg.learner_id = $1
       order by lg.is_primary desc, p.full_name`,
      [learnerId],
    );
  }

  async addGuardian(
    learnerId: string,
    input: {
      guardianId: string;
      relationship: string;
      isPrimary?: boolean;
      isBillingContact?: boolean;
    },
  ): Promise<LearnerGuardianRow> {
    const result = await this.sp.executeRaw<{
      learner_id: string;
      guardian_id: string;
    }>(
      `insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact)
       values ($1, $2, $3, coalesce($4, false), coalesce($5, false))
       returning learner_id, guardian_id`,
      [
        learnerId,
        input.guardianId,
        input.relationship,
        input.isPrimary ?? null,
        input.isBillingContact ?? null,
      ],
    );
    const inserted = result.rows[0];
    if (!inserted)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    const row = await this.getGuardianLink(learnerId, inserted.guardian_id);
    if (!row)
      throw new Error(
        'Freshly inserted learner_guardians row could not be re-read',
      );
    return row;
  }

  async setContactFlags(
    learnerId: string,
    guardianId: string,
    input: { isPrimary?: boolean; isBillingContact?: boolean },
  ): Promise<LearnerGuardianRow | undefined> {
    await this.sp.executeRaw(
      `update public.learner_guardians
       set is_primary = coalesce($3, is_primary), is_billing_contact = coalesce($4, is_billing_contact)
       where learner_id = $1 and guardian_id = $2`,
      [
        learnerId,
        guardianId,
        input.isPrimary ?? null,
        input.isBillingContact ?? null,
      ],
    );
    return this.getGuardianLink(learnerId, guardianId);
  }

  private getGuardianLink(
    learnerId: string,
    guardianId: string,
  ): Promise<LearnerGuardianRow | undefined> {
    return this.sp.selectOne<LearnerGuardianRow>(
      `select lg.learner_id, lg.guardian_id, p.full_name as guardian_name, p.phone as guardian_phone,
              lg.relationship, lg.is_primary, lg.is_billing_contact
       from public.learner_guardians lg
       left join public.profiles p on p.id = lg.guardian_id
       where lg.learner_id = $1 and lg.guardian_id = $2`,
      [learnerId, guardianId],
    );
  }

  listEmergencyContacts(learnerId: string): Promise<EmergencyContactRow[]> {
    return this.sp.selectMany<EmergencyContactRow>(
      `select id, learner_id, full_name, relationship, phone, priority
       from public.learner_emergency_contacts where learner_id = $1 order by priority`,
      [learnerId],
    );
  }

  async addEmergencyContact(
    learnerId: string,
    input: {
      fullName: string;
      relationship: string;
      phone: string;
      priority: number;
    },
  ): Promise<EmergencyContactRow> {
    const result = await this.sp.executeRaw<EmergencyContactRow>(
      `insert into public.learner_emergency_contacts (learner_id, full_name, relationship, phone, priority)
       values ($1, $2, $3, $4, $5)
       returning id, learner_id, full_name, relationship, phone, priority`,
      [
        learnerId,
        input.fullName,
        input.relationship,
        input.phone,
        input.priority,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  async removeEmergencyContact(
    learnerId: string,
    contactId: string,
  ): Promise<number> {
    const result = await this.sp.executeRaw(
      'delete from public.learner_emergency_contacts where learner_id = $1 and id = $2',
      [learnerId, contactId],
    );
    return result.rowCount;
  }

  listCollectors(learnerId: string): Promise<AuthorisedCollectorRow[]> {
    return this.sp.selectMany<AuthorisedCollectorRow>(
      `select id, learner_id, full_name, relationship, phone, id_number_last4, active_from, active_to
       from public.authorised_collectors where learner_id = $1 order by full_name`,
      [learnerId],
    );
  }

  async addCollector(
    learnerId: string,
    input: {
      fullName: string;
      relationship: string;
      phone: string;
      idNumberLast4?: string;
      activeFrom?: string;
      activeTo?: string;
    },
  ): Promise<AuthorisedCollectorRow> {
    const result = await this.sp.executeRaw<AuthorisedCollectorRow>(
      `insert into public.authorised_collectors (learner_id, full_name, relationship, phone, id_number_last4, active_from, active_to)
       values ($1, $2, $3, $4, $5, coalesce($6, current_date), $7)
       returning id, learner_id, full_name, relationship, phone, id_number_last4, active_from, active_to`,
      [
        learnerId,
        input.fullName,
        input.relationship,
        input.phone,
        input.idNumberLast4 ?? null,
        input.activeFrom ?? null,
        input.activeTo ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  async removeCollector(
    learnerId: string,
    collectorId: string,
  ): Promise<number> {
    const result = await this.sp.executeRaw(
      'delete from public.authorised_collectors where learner_id = $1 and id = $2',
      [learnerId, collectorId],
    );
    return result.rowCount;
  }

  getMedicalNotes(learnerId: string): Promise<MedicalNotesRow | undefined> {
    return this.sp.selectOne<MedicalNotesRow>(
      `select learner_id, allergies, conditions, medication, accommodations, updated_at, updated_by
       from public.learner_medical_notes where learner_id = $1`,
      [learnerId],
    );
  }

  async upsertMedicalNotes(
    learnerId: string,
    input: {
      allergies?: string;
      conditions?: string;
      medication?: string;
      accommodations?: string;
    },
    updatedBy: string,
  ): Promise<MedicalNotesRow> {
    const result = await this.sp.executeRaw<MedicalNotesRow>(
      `insert into public.learner_medical_notes (learner_id, allergies, conditions, medication, accommodations, updated_by)
       values ($1, coalesce($2, ''), coalesce($3, ''), coalesce($4, ''), coalesce($5, ''), $6)
       on conflict (learner_id) do update set
         allergies = coalesce($2, learner_medical_notes.allergies),
         conditions = coalesce($3, learner_medical_notes.conditions),
         medication = coalesce($4, learner_medical_notes.medication),
         accommodations = coalesce($5, learner_medical_notes.accommodations),
         updated_at = now(),
         updated_by = $6
       returning learner_id, allergies, conditions, medication, accommodations, updated_at, updated_by`,
      [
        learnerId,
        input.allergies ?? null,
        input.conditions ?? null,
        input.medication ?? null,
        input.accommodations ?? null,
        updatedBy,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('UPSERT ... RETURNING unexpectedly returned no row');
    return row;
  }
}
