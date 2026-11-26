import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param.js';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type {
  ApproveApplicationResultDto,
  RecruitmentStatusDto,
} from './dto/tutor-application.dto.js';

/** A staged file the API must move once the database has recorded it. */
export interface FiledMove {
  stagingPath: string;
  storagePath: string;
}

export interface RecruitmentRoundRow {
  id: string;
  opened_at: Date;
  closes_at: Date | null;
  closed_at: Date | null;
  message: string;
  police_clearance_required: boolean;
  is_open: boolean;
  needs: string[];
  application_count: string;
}

export interface ApplicationListRow {
  id: string;
  round_id: string;
  applicant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  province: string;
  country: string;
  status: string;
  decision_note: string;
  submitted_at: Date;
  reviewed_at: Date | null;
  police_clearance_required: boolean;
  police_clearance_requested_at: Date | null;
  police_clearance_request_note: string;
  has_police_clearance: boolean;
  identity_checked_at: Date | null;
  tutor_id: string | null;
  subjects: { subject: string; grades: { name: string; order: number }[] }[];
}

/** The applicant's own row, read under RLS ("tutor applications: own or admin read"). */
export interface OwnApplicationRow {
  id: string;
  round_id: string;
  status: string;
  submitted_at: Date;
  police_clearance_required: boolean;
  police_clearance_requested_at: Date | null;
  police_clearance_request_note: string;
  has_police_clearance: boolean;
}

export interface ApplicationCompetencyRow {
  subject_code: string;
  subject_name: string;
  grade_code: string;
  grade_name: string;
  languages: string[];
}

export interface ApplicationDocumentRow {
  id: string;
  doc_type: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  title: string;
  institution: string;
  year_awarded: number | null;
  uploaded_at: Date;
}

export interface ApplicationReferenceRow {
  position: number;
  full_name: string;
  relationship: string;
  phone: string;
  email: string;
}

/**
 * `db/migrations/20261126000001_tutor_applications.sql`. Submission, withdrawal
 * and the police-clearance upload take storage paths, so they are `private`
 * (API only) and run as the signed-in applicant (`auth.uid()` inside). The
 * admin functions are public and check `private.is_admin()` themselves. Reads
 * of the application's parts are plain selects under RLS (own or admin).
 */
@Injectable()
export class TutorApplicationsRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  private async jsonb<T>(fn: string, params: Parameters<StoredProcRunner['queryOne']>[1] = []): Promise<T> {
    const name = fn.slice(fn.indexOf('.') + 1);
    const row = await this.sp.queryOne<Record<string, T>>(fn, params);
    if (!row) throw new Error(`${fn} unexpectedly returned no row`);
    return row[name] as T;
  }

  // Recruitment ------------------------------------------------------------------

  status(): Promise<RecruitmentStatusDto> {
    return this.jsonb('public.tutor_recruitment_status');
  }

  listRounds(): Promise<RecruitmentRoundRow[]> {
    return this.sp.selectMany<RecruitmentRoundRow>(
      `select r.id, r.opened_at, r.closes_at, r.closed_at, r.message, r.police_clearance_required,
              (r.closed_at is null and (r.closes_at is null or r.closes_at > now())) as is_open,
              coalesce(array(select n.subject_code from public.tutor_recruitment_needs n where n.round_id = r.id
                              order by n.subject_code), '{}') as needs,
              (select count(*) from public.tutor_applications a where a.round_id = r.id) as application_count
         from public.tutor_recruitment_rounds r
        order by r.opened_at desc
        limit 20`,
    );
  }

  async open(settings: RecruitmentSettings): Promise<string> {
    const row = await this.sp.queryOne<{ open_tutor_recruitment: string }>('public.open_tutor_recruitment', [
      p.timestamptz('p_closes_at', settings.closesAt),
      p.text('p_message', settings.message),
      p.textArray('p_needs', settings.needs),
      p.bool('p_police_clearance_required', settings.policeClearanceRequired),
    ]);
    if (!row) throw new Error('open_tutor_recruitment unexpectedly returned no row');
    return row.open_tutor_recruitment;
  }

  async update(settings: RecruitmentSettings): Promise<void> {
    await this.sp.queryOne('public.update_tutor_recruitment', [
      p.timestamptz('p_closes_at', settings.closesAt),
      p.text('p_message', settings.message),
      p.textArray('p_needs', settings.needs),
      p.bool('p_police_clearance_required', settings.policeClearanceRequired),
    ]);
  }

  async close(): Promise<void> {
    await this.sp.queryOne('public.close_tutor_recruitment');
  }

  // Applicant ----------------------------------------------------------------------

  submit(application: Record<string, unknown>): Promise<{ applicationId: string; documents: FiledMove[] }> {
    return this.jsonb('private.submit_tutor_application', [p.jsonb('p_application', application)]);
  }

  async withdraw(applicationId: string): Promise<void> {
    await this.sp.queryOne('private.withdraw_tutor_application', [p.uuid('p_application_id', applicationId)]);
  }

  addPoliceClearance(document: Record<string, unknown>): Promise<FiledMove> {
    return this.jsonb('private.add_police_clearance', [p.jsonb('p_document', document)]);
  }

  /** The caller's most recent application, if any (RLS limits the select to their own). */
  latestOwn(applicantId: string): Promise<OwnApplicationRow | undefined> {
    return this.sp.selectOne<OwnApplicationRow>(
      `select a.id, a.round_id, a.status, a.submitted_at, a.police_clearance_required,
              a.police_clearance_requested_at, a.police_clearance_request_note,
              exists (select 1 from public.tutor_application_documents d
                       where d.application_id = a.id and d.doc_type = 'police_clearance') as has_police_clearance
         from public.tutor_applications a
        where a.applicant_id = $1
        order by a.submitted_at desc
        limit 1`,
      [applicantId],
    );
  }

  // Review ---------------------------------------------------------------------------

  list(status: string | null, roundId: string | null, applicationId: string | null = null): Promise<ApplicationListRow[]> {
    return this.sp.queryMany<ApplicationListRow>('public.list_tutor_applications', [
      p.text('p_status', status),
      p.uuid('p_round_id', roundId),
      p.uuid('p_application_id', applicationId),
    ]);
  }

  listCompetencies(applicationId: string): Promise<ApplicationCompetencyRow[]> {
    return this.sp.selectMany<ApplicationCompetencyRow>(
      `select c.subject_code, s.name as subject_name, c.grade_code, g.name as grade_name,
              coalesce(array(select l.name from public.tutor_application_competency_media m
                               join public.languages l on l.code = m.language_code
                              where m.competency_id = c.id order by l.sort_order), '{}') as languages
         from public.tutor_application_competencies c
         join public.subjects s on s.code = c.subject_code
         join public.grades g on g.code = c.grade_code
        where c.application_id = $1
        order by s.sort_order, g.sort_order`,
      [applicationId],
    );
  }

  listDocuments(applicationId: string): Promise<ApplicationDocumentRow[]> {
    return this.sp.selectMany<ApplicationDocumentRow>(
      `select id, doc_type, storage_path, original_name, mime_type, size_bytes, title, institution,
              year_awarded, uploaded_at
         from public.tutor_application_documents
        where application_id = $1
        order by array_position(array['id', 'id_back', 'selfie', 'cv', 'qualification', 'police_clearance'], doc_type),
                 uploaded_at`,
      [applicationId],
    );
  }

  listReferences(applicationId: string): Promise<ApplicationReferenceRow[]> {
    return this.sp.selectMany<ApplicationReferenceRow>(
      `select position, full_name, relationship, phone, email
         from public.tutor_application_references
        where application_id = $1
        order by position`,
      [applicationId],
    );
  }

  async setStatus(applicationId: string, status: string, note: string | null): Promise<void> {
    await this.sp.queryOne('public.set_tutor_application_status', [
      p.uuid('p_application_id', applicationId),
      p.text('p_status', status),
      p.text('p_note', note ?? ''),
    ]);
  }

  async markIdentityChecked(applicationId: string): Promise<void> {
    await this.sp.queryOne('public.mark_tutor_application_identity_checked', [
      p.uuid('p_application_id', applicationId),
    ]);
  }

  approve(applicationId: string): Promise<ApproveApplicationResultDto> {
    return this.jsonb('public.approve_tutor_application', [p.uuid('p_application_id', applicationId)]);
  }

  /** Unsuccessful applications past their 12 months (`v_tutor_application_retention_due`, admin only). */
  listRetentionDue(): Promise<RetentionDueRow[]> {
    return this.sp.selectMany<RetentionDueRow>(
      `select d.application_id, a.first_name, a.last_name, d.status, d.decided_at, d.due_on
         from public.v_tutor_application_retention_due d
         join public.tutor_applications a on a.id = d.application_id
        order by d.due_on`,
    );
  }

  /** Deletes the rows and logs it; returns the files the caller must remove from storage. */
  purge(applicationId: string): Promise<{ storagePaths: string[] }> {
    return this.jsonb('public.purge_tutor_application', [p.uuid('p_application_id', applicationId)]);
  }

  async requestPoliceClearance(target: { applicationId?: string; tutorId?: string }, note: string | null): Promise<void> {
    await this.sp.queryOne('public.request_police_clearance', [
      p.uuid('p_application_id', target.applicationId ?? null),
      p.uuid('p_tutor_id', target.tutorId ?? null),
      p.text('p_note', note ?? ''),
    ]);
  }
}

export interface RetentionDueRow {
  application_id: string;
  first_name: string;
  last_name: string;
  status: string;
  decided_at: Date;
  due_on: Date | string;
}

export interface RecruitmentSettings {
  closesAt: string | null;
  message: string;
  needs: string[];
  policeClearanceRequired: boolean;
}
