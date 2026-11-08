import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param.js';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { TutorDocumentRow } from './rows/tutor-document.row.js';
import type { TutorPayRateRow } from './rows/tutor-pay-rate.row.js';
import type { TutorQualificationRow } from './rows/tutor-qualification.row.js';
import type { TutorReferenceRow } from './rows/tutor-reference.row.js';
import type { TutorSpokenLanguageRow } from './rows/tutor-spoken-language.row.js';
import type { TutorCompetencyRow } from './rows/tutor-competency.row.js';
import type { TutorRatingRow, TutorRow } from './rows/tutor.row.js';

const TUTOR_COLUMNS =
  'id, profile_id, slug, headline, bio, employment_type, status, photo_url, started_on, ended_on, created_at';

interface ListPublicFilter {
  page: number;
  pageSize: number;
  search?: string;
}

/**
 * Three real Postgres functions already exist for the write paths that need
 * atomicity or admin-only validation (`db/migrations/20261020000018_tutor_admin.sql`):
 * `create_tutor` (BR-23: existing account only), `set_tutor_competency`
 * (upsert + replace media in one statement), `set_tutor_pay_rate` (closes
 * the open rate before inserting, so the no-overlap exclusion constraint
 * never fires on the caller). Everything else here is a plain table
 * read/write, same convention as `reference`/`people`.
 */
@Injectable()
export class TutorsRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  async listPublic(
    filter: ListPublicFilter,
  ): Promise<{ rows: TutorRow[]; totalCount: number }> {
    const values: unknown[] = [];
    let whereClause = '';
    if (filter.search) {
      values.push(`%${filter.search}%`);
      whereClause = `where headline ilike $${values.length} or slug ilike $${values.length}`;
    }
    values.push(filter.pageSize, (filter.page - 1) * filter.pageSize);

    const result = await this.sp.executeRaw<TutorRow & { total_count: string }>(
      `select ${TUTOR_COLUMNS}, count(*) over() as total_count
       from public.tutors
       ${whereClause}
       order by slug
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    const firstRow = result.rows[0];
    return {
      rows: result.rows,
      totalCount: firstRow ? Number(firstRow.total_count) : 0,
    };
  }

  getBySlug(slug: string): Promise<TutorRow | undefined> {
    return this.sp.selectOne<TutorRow>(
      `select ${TUTOR_COLUMNS} from public.tutors where slug = $1`,
      [slug],
    );
  }

  getById(id: string): Promise<TutorRow | undefined> {
    return this.sp.selectOne<TutorRow>(
      `select ${TUTOR_COLUMNS} from public.tutors where id = $1`,
      [id],
    );
  }

  getByProfileId(profileId: string): Promise<TutorRow | undefined> {
    return this.sp.selectOne<TutorRow>(
      `select ${TUTOR_COLUMNS} from public.tutors where profile_id = $1`,
      [profileId],
    );
  }

  getRating(tutorId: string): Promise<TutorRatingRow | undefined> {
    return this.sp.selectOne<TutorRatingRow>(
      'select tutor_id, review_count, rating from public.tutor_rating_summary where tutor_id = $1',
      [tutorId],
    );
  }

  async updateMyProfile(
    profileId: string,
    input: { headline?: string; bio?: string; photoUrl?: string },
  ): Promise<TutorRow> {
    const result = await this.sp.executeRaw<TutorRow>(
      `update public.tutors
       set headline = coalesce($2, headline), bio = coalesce($3, bio), photo_url = coalesce($4, photo_url)
       where profile_id = $1
       returning ${TUTOR_COLUMNS}`,
      [
        profileId,
        input.headline ?? null,
        input.bio ?? null,
        input.photoUrl ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('UPDATE ... RETURNING unexpectedly returned no row');
    return row;
  }

  /** Calls `public.create_tutor`; throws the mapped error as-is (see TutorsManager — the NOT_FOUND / already-a-tutor cases are both surfaced from this one call). */
  async createTutor(input: {
    email: string;
    slug: string;
    employmentType: string;
    headline?: string;
  }): Promise<string> {
    const row = await this.sp.queryOne<{ create_tutor: string }>(
      'public.create_tutor',
      [
        p.text('p_email', input.email),
        p.text('p_slug', input.slug),
        p.text('p_employment_type', input.employmentType),
        p.text('p_headline', input.headline ?? ''),
      ],
    );
    if (!row) throw new Error('create_tutor unexpectedly returned no row');
    return row.create_tutor;
  }

  listCompetencies(tutorId: string): Promise<TutorCompetencyRow[]> {
    return this.sp.selectMany<TutorCompetencyRow>(
      `select c.id, c.tutor_id, c.subject_code, c.grade_code,
              coalesce(array_agg(m.language_code order by m.language_code) filter (where m.language_code is not null), '{}') as media_language_codes
       from public.tutor_competencies c
       left join public.tutor_competency_media m on m.competency_id = c.id
       where c.tutor_id = $1
       group by c.id, c.tutor_id, c.subject_code, c.grade_code
       order by c.subject_code, c.grade_code`,
      [tutorId],
    );
  }

  async setCompetency(input: {
    tutorId: string;
    subjectCode: string;
    gradeCode: string;
    mediaLanguageCodes: string[];
  }): Promise<string> {
    const row = await this.sp.queryOne<{ set_tutor_competency: string }>(
      'public.set_tutor_competency',
      [
        p.uuid('p_tutor_id', input.tutorId),
        p.text('p_subject', input.subjectCode),
        p.text('p_grade', input.gradeCode),
        p.textArray('p_languages', input.mediaLanguageCodes),
      ],
    );
    if (!row)
      throw new Error('set_tutor_competency unexpectedly returned no row');
    return row.set_tutor_competency;
  }

  getCompetencyById(id: string): Promise<TutorCompetencyRow | undefined> {
    return this.sp.selectOne<TutorCompetencyRow>(
      `select c.id, c.tutor_id, c.subject_code, c.grade_code,
              coalesce(array_agg(m.language_code order by m.language_code) filter (where m.language_code is not null), '{}') as media_language_codes
       from public.tutor_competencies c
       left join public.tutor_competency_media m on m.competency_id = c.id
       where c.id = $1
       group by c.id, c.tutor_id, c.subject_code, c.grade_code`,
      [id],
    );
  }

  listSpokenLanguages(tutorId: string): Promise<TutorSpokenLanguageRow[]> {
    return this.sp.selectMany<TutorSpokenLanguageRow>(
      'select tutor_id, language_code from public.tutor_spoken_languages where tutor_id = $1 order by language_code',
      [tutorId],
    );
  }

  async clearSpokenLanguages(tutorId: string): Promise<void> {
    await this.sp.executeRaw(
      'delete from public.tutor_spoken_languages where tutor_id = $1',
      [tutorId],
    );
  }

  async insertSpokenLanguages(
    tutorId: string,
    languageCodes: string[],
  ): Promise<void> {
    if (languageCodes.length === 0) return;
    await this.sp.executeRaw(
      'insert into public.tutor_spoken_languages (tutor_id, language_code) select $1, unnest($2::text[])',
      [tutorId, languageCodes],
    );
  }

  listQualifications(tutorId: string): Promise<TutorQualificationRow[]> {
    return this.sp.selectMany<TutorQualificationRow>(
      `select id, tutor_id, qualification_type, title, institution, year_awarded, verified_at, verified_by
       from public.tutor_qualifications where tutor_id = $1 order by year_awarded desc nulls last`,
      [tutorId],
    );
  }

  async addQualification(
    tutorId: string,
    input: {
      qualificationType: string;
      title: string;
      institution?: string;
      yearAwarded?: number;
    },
  ): Promise<TutorQualificationRow> {
    const result = await this.sp.executeRaw<TutorQualificationRow>(
      `insert into public.tutor_qualifications (tutor_id, qualification_type, title, institution, year_awarded)
       values ($1, $2, $3, coalesce($4, ''), $5)
       returning id, tutor_id, qualification_type, title, institution, year_awarded, verified_at, verified_by`,
      [
        tutorId,
        input.qualificationType,
        input.title,
        input.institution ?? null,
        input.yearAwarded ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  listDocuments(tutorId: string): Promise<TutorDocumentRow[]> {
    return this.sp.selectMany<TutorDocumentRow>(
      `select id, tutor_id, doc_type, storage_path, uploaded_at, verified_at, verified_by
       from public.tutor_documents where tutor_id = $1 order by uploaded_at desc`,
      [tutorId],
    );
  }

  async createDocumentRecord(
    tutorId: string,
    docType: string,
    storagePath: string,
  ): Promise<TutorDocumentRow> {
    const result = await this.sp.executeRaw<TutorDocumentRow>(
      `insert into public.tutor_documents (tutor_id, doc_type, storage_path)
       values ($1, $2, $3)
       returning id, tutor_id, doc_type, storage_path, uploaded_at, verified_at, verified_by`,
      [tutorId, docType, storagePath],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  listReferences(tutorId: string): Promise<TutorReferenceRow[]> {
    return this.sp.selectMany<TutorReferenceRow>(
      `select id, tutor_id, full_name, relationship, phone, email, checked_at, checked_by, outcome
       from public.tutor_references where tutor_id = $1 order by full_name`,
      [tutorId],
    );
  }

  async addReference(
    tutorId: string,
    input: {
      fullName: string;
      relationship: string;
      phone?: string;
      email?: string;
    },
  ): Promise<TutorReferenceRow> {
    const result = await this.sp.executeRaw<TutorReferenceRow>(
      `insert into public.tutor_references (tutor_id, full_name, relationship, phone, email)
       values ($1, $2, $3, coalesce($4, ''), coalesce($5, ''))
       returning id, tutor_id, full_name, relationship, phone, email, checked_at, checked_by, outcome`,
      [
        tutorId,
        input.fullName,
        input.relationship,
        input.phone ?? null,
        input.email ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  async recordReferenceOutcome(
    tutorId: string,
    referenceId: string,
    outcome: string,
    checkedBy: string,
  ): Promise<TutorReferenceRow | undefined> {
    const result = await this.sp.executeRaw<TutorReferenceRow>(
      `update public.tutor_references
       set outcome = $3, checked_at = now(), checked_by = $4
       where tutor_id = $1 and id = $2
       returning id, tutor_id, full_name, relationship, phone, email, checked_at, checked_by, outcome`,
      [tutorId, referenceId, outcome, checkedBy],
    );
    return result.rows[0];
  }

  listPayRates(tutorId: string): Promise<TutorPayRateRow[]> {
    return this.sp.selectMany<TutorPayRateRow>(
      `select id, tutor_id, pay_basis, amount_cents, effective_from, effective_to, created_at
       from public.tutor_pay_rates where tutor_id = $1 order by effective_from desc`,
      [tutorId],
    );
  }

  /**
   * `effectiveFrom` is OMITTED from the call entirely (never sent as an
   * explicit `null`) when not provided, so Postgres's own `default
   * current_date` applies — a named-parameter call that passes `null`
   * explicitly does NOT fall back to the SQL default, defaults only apply
   * when an argument is left out of the call altogether. Letting Postgres
   * resolve "today" also keeps this on the database's own timezone, same
   * as everywhere else in this schema (phase0 §5: no app-layer tz math).
   */
  async setPayRate(input: {
    tutorId: string;
    payBasis: string;
    amountCents: number;
    effectiveFrom?: string;
  }): Promise<string> {
    const params = [
      p.uuid('p_tutor_id', input.tutorId),
      p.text('p_pay_basis', input.payBasis),
      p.int('p_amount_cents', input.amountCents),
    ];
    if (input.effectiveFrom)
      params.push(p.date('p_effective_from', input.effectiveFrom));
    const row = await this.sp.queryOne<{ set_tutor_pay_rate: string }>(
      'public.set_tutor_pay_rate',
      params,
    );
    if (!row)
      throw new Error('set_tutor_pay_rate unexpectedly returned no row');
    return row.set_tutor_pay_rate;
  }

  getPayRateById(id: string): Promise<TutorPayRateRow | undefined> {
    return this.sp.selectOne<TutorPayRateRow>(
      `select id, tutor_id, pay_basis, amount_cents, effective_from, effective_to, created_at
       from public.tutor_pay_rates where id = $1`,
      [id],
    );
  }
}
