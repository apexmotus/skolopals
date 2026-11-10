import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { TutorsRepository } from './tutors.repository.js';

function makeSp(
  overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {},
): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    selectOne: vi.fn().mockResolvedValue(undefined),
    executeRaw: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    queryOne: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('TutorsRepository', () => {
  it('createTutor calls the existing public.create_tutor function with named params', async () => {
    const queryOne = vi
      .fn()
      .mockResolvedValue({ create_tutor: 'new-tutor-id' });
    const repo = new TutorsRepository(makeSp({ queryOne }));

    const id = await repo.createTutor({
      email: 'x@test',
      slug: 'x',
      employmentType: 'sessional',
    });

    expect(id).toBe('new-tutor-id');
    expect(queryOne).toHaveBeenCalledWith(
      'public.create_tutor',
      expect.arrayContaining([
        expect.objectContaining({ name: 'p_email', value: 'x@test' }),
        expect.objectContaining({ name: 'p_slug', value: 'x' }),
        expect.objectContaining({
          name: 'p_employment_type',
          value: 'sessional',
        }),
        expect.objectContaining({ name: 'p_headline', value: '' }),
      ]),
    );
  });

  it('setCompetency calls public.set_tutor_competency with the language array', async () => {
    const queryOne = vi
      .fn()
      .mockResolvedValue({ set_tutor_competency: 'competency-1' });
    const repo = new TutorsRepository(makeSp({ queryOne }));

    const id = await repo.setCompetency({
      tutorId: 't1',
      subjectCode: 'mathematics',
      gradeCode: 'grade_7',
      mediaLanguageCodes: ['english'],
    });

    expect(id).toBe('competency-1');
    expect(queryOne).toHaveBeenCalledWith(
      'public.set_tutor_competency',
      expect.arrayContaining([
        expect.objectContaining({ name: 'p_languages', value: ['english'] }),
      ]),
    );
  });

  it('setPayRate omits p_effective_from entirely when not given, so the SQL default applies', async () => {
    const queryOne = vi
      .fn()
      .mockResolvedValue({ set_tutor_pay_rate: 'rate-1' });
    const repo = new TutorsRepository(makeSp({ queryOne }));

    await repo.setPayRate({
      tutorId: 't1',
      payBasis: 'per_hour',
      amountCents: 15000,
    });

    const params = queryOne.mock.calls[0]?.[1] as { name: string }[];
    expect(params.map((param) => param.name)).not.toContain('p_effective_from');
  });

  it('setPayRate includes p_effective_from when given', async () => {
    const queryOne = vi
      .fn()
      .mockResolvedValue({ set_tutor_pay_rate: 'rate-1' });
    const repo = new TutorsRepository(makeSp({ queryOne }));

    await repo.setPayRate({
      tutorId: 't1',
      payBasis: 'per_hour',
      amountCents: 15000,
      effectiveFrom: '2026-01-01',
    });

    const params = queryOne.mock.calls[0]?.[1] as {
      name: string;
      value: unknown;
    }[];
    expect(params).toContainEqual({
      name: 'p_effective_from',
      value: '2026-01-01',
    });
  });

  it('insertSpokenLanguages is a no-op for an empty array (never sends an empty unnest)', async () => {
    const executeRaw = vi.fn();
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    await repo.insertSpokenLanguages('t1', []);

    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('insertSpokenLanguages unnests the array in one statement', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 2 });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    await repo.insertSpokenLanguages('t1', ['english', 'afrikaans']);

    expect(executeRaw).toHaveBeenCalledWith(
      expect.stringContaining('unnest($2::text[])'),
      ['t1', ['english', 'afrikaans']],
    );
  });

  it('listPublic with no search omits the WHERE clause', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    await repo.listPublic({ page: 1, pageSize: 20 });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('where');
    expect(values).toEqual([20, 0]);
  });

  it('listPublic with a search term filters on headline or slug', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    await repo.listPublic({ page: 1, pageSize: 20, search: 'Maya' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('headline ilike $1');
    expect(sql).toContain('slug ilike $1');
    expect(values).toEqual(['%Maya%', 20, 0]);
  });

  it('listPublic always left-joins tutor_rating_summary, even with no filters', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    await repo.listPublic({ page: 1, pageSize: 20 });

    const [sql] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('left join public.tutor_rating_summary r on r.tutor_id = t.id');
    expect(sql).toContain('join public.profiles p on p.id = t.profile_id');
    expect(sql).toContain('p.full_name');
  });

  it('getBySlug joins profiles for the tutor\'s full name', async () => {
    const selectOne = vi.fn().mockResolvedValue(undefined);
    const repo = new TutorsRepository(makeSp({ selectOne }));

    await repo.getBySlug('maya-thompson');

    const [sql, values] = selectOne.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('join public.profiles p on p.id = t.profile_id');
    expect(sql).toContain('p.full_name');
    expect(sql).toContain('where t.slug = $1');
    expect(values).toEqual(['maya-thompson']);
  });

  it('updateMyProfile returns the full name via an UPDATE ... FROM ... RETURNING join', async () => {
    const executeRaw = vi.fn().mockResolvedValue({
      rows: [{ id: 't1', profile_id: 'p1', slug: 'maya-thompson', full_name: 'Maya Thompson', headline: 'New', bio: '', employment_type: 'sessional', status: 'active', photo_url: null, started_on: '2026-01-01', ended_on: null, created_at: new Date() }],
      rowCount: 1,
    });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    const row = await repo.updateMyProfile('p1', { headline: 'New' });

    const [sql] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('from public.profiles p');
    expect(sql).toContain('p.full_name');
    expect(row.full_name).toBe('Maya Thompson');
  });

  it('listPublic with subject/grade filters adds an exists-clause against tutor_competencies for each', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    await repo.listPublic({ page: 1, pageSize: 20, subject: 'MATH', grade: 'G10' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('c.subject_code = $1');
    expect(sql).toContain('c.grade_code = $2');
    expect(values).toEqual(['MATH', 'G10', 20, 0]);
  });

  it('listPublic with a language filter adds an exists-clause against tutor_spoken_languages', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    await repo.listPublic({ page: 1, pageSize: 20, language: 'EN' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('l.language_code = $1');
    expect(sql).toContain('from public.tutor_spoken_languages l');
    expect(values).toEqual(['EN', 20, 0]);
  });

  it('getRating reads tutor_rating_summary scoped to the tutor', async () => {
    const selectOne = vi.fn().mockResolvedValue(undefined);
    const repo = new TutorsRepository(makeSp({ selectOne }));

    await repo.getRating('t1');

    const [sql, values] = selectOne.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('from public.tutor_rating_summary where tutor_id = $1');
    expect(values).toEqual(['t1']);
  });

  it('addQualification defaults institution to empty and passes a null yearAwarded through when omitted', async () => {
    const executeRaw = vi.fn().mockResolvedValue({
      rows: [{ id: 'q1', tutor_id: 't1', qualification_type: 'degree', title: 'BEd', institution: '', year_awarded: null, verified_at: null, verified_by: null }],
      rowCount: 1,
    });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    await repo.addQualification('t1', { qualificationType: 'degree', title: 'BEd' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("coalesce($4, '')");
    expect(values).toEqual(['t1', 'degree', 'BEd', null, null]);
  });

  it('addQualification throws if the insert unexpectedly returns no row', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    await expect(repo.addQualification('t1', { qualificationType: 'degree', title: 'BEd' })).rejects.toThrow(
      'INSERT ... RETURNING unexpectedly returned no row',
    );
  });

  it('createDocumentRecord inserts the tutor/docType/storagePath triple', async () => {
    const executeRaw = vi.fn().mockResolvedValue({
      rows: [{ id: 'd1', tutor_id: 't1', doc_type: 'id_document', storage_path: 't1/id_document/x.pdf', uploaded_at: new Date(), verified_at: null, verified_by: null }],
      rowCount: 1,
    });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    await repo.createDocumentRecord('t1', 'id_document', 't1/id_document/x.pdf');

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert into public.tutor_documents');
    expect(values).toEqual(['t1', 'id_document', 't1/id_document/x.pdf']);
  });

  it('recordReferenceOutcome scopes the update to both the tutor and the reference', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new TutorsRepository(makeSp({ executeRaw }));

    const row = await repo.recordReferenceOutcome('t1', 'ref-1', 'positive', 'admin-1');

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('where tutor_id = $1 and id = $2');
    expect(values).toEqual(['t1', 'ref-1', 'positive', 'admin-1']);
    expect(row).toBeUndefined();
  });
});
