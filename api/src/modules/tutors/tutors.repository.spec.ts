import type { StoredProcRunner } from '../../database/stored-proc.runner';
import { TutorsRepository } from './tutors.repository';

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
});
