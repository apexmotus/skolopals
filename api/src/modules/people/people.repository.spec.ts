import type { StoredProcRunner } from '../../database/stored-proc.runner';
import { PeopleRepository } from './people.repository';

function makeSp(
  overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {},
): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    selectOne: vi.fn().mockResolvedValue(undefined),
    executeRaw: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('PeopleRepository', () => {
  it('canViewLearner calls the existing Postgres helper function directly, by learner id', async () => {
    const selectOne = vi.fn().mockResolvedValue({ allowed: true });
    const repo = new PeopleRepository(makeSp({ selectOne }));

    await expect(repo.canViewLearner('learner-1')).resolves.toBe(true);
    expect(selectOne).toHaveBeenCalledWith(
      'select private.can_view_learner($1) as allowed',
      ['learner-1'],
    );
  });

  it('canViewLearnerPrivate calls the private-tier helper function', async () => {
    const selectOne = vi.fn().mockResolvedValue({ allowed: false });
    const repo = new PeopleRepository(makeSp({ selectOne }));

    await expect(repo.canViewLearnerPrivate('learner-1')).resolves.toBe(false);
    expect(selectOne).toHaveBeenCalledWith(
      'select private.can_view_learner_private($1) as allowed',
      ['learner-1'],
    );
  });

  it('listLearners with no filters omits the WHERE clause', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new PeopleRepository(makeSp({ executeRaw }));

    await repo.listLearners({ page: 1, pageSize: 20 });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('where');
    expect(values).toEqual([20, 0]);
  });

  it('listLearners builds a parameterized WHERE clause from every provided filter', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new PeopleRepository(makeSp({ executeRaw }));

    await repo.listLearners({
      page: 2,
      pageSize: 10,
      search: 'Al',
      gradeCode: 'grade_7',
      status: 'active',
    });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('full_name ilike $1');
    expect(sql).toContain('grade_code = $2');
    expect(sql).toContain('status = $3');
    expect(sql).toContain('limit $4 offset $5');
    expect(values).toEqual(['%Al%', 'grade_7', 'active', 10, 10]);
  });

  it('createLearner inserts and returns the new row', async () => {
    const newRow = { id: 'l1', full_name: 'New Learner' };
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [newRow], rowCount: 1 });
    const repo = new PeopleRepository(makeSp({ executeRaw }));

    const row = await repo.createLearner({
      fullName: 'New Learner',
      dateOfBirth: '2013-01-01',
      gradeCode: 'grade_7',
    });

    expect(row).toEqual(newRow);
    expect(executeRaw).toHaveBeenCalledWith(
      expect.stringContaining('insert into public.learners'),
      ['New Learner', '2013-01-01', 'grade_7', null, null],
    );
  });

  it('addGuardian inserts the link, then re-reads it joined against profiles', async () => {
    const executeRaw = vi.fn().mockResolvedValue({
      rows: [{ learner_id: 'l1', guardian_id: 'g1' }],
      rowCount: 1,
    });
    const joinedRow = {
      learner_id: 'l1',
      guardian_id: 'g1',
      guardian_name: 'Guardian One',
      guardian_phone: null,
      relationship: 'mother',
      is_primary: false,
      is_billing_contact: false,
    };
    const selectOne = vi.fn().mockResolvedValue(joinedRow);
    const repo = new PeopleRepository(makeSp({ executeRaw, selectOne }));

    const row = await repo.addGuardian('l1', {
      guardianId: 'g1',
      relationship: 'mother',
    });

    expect(row).toEqual(joinedRow);
    expect(executeRaw).toHaveBeenCalledWith(
      expect.stringContaining('insert into public.learner_guardians'),
      ['l1', 'g1', 'mother', null, null],
    );
    expect(selectOne).toHaveBeenCalledWith(
      expect.stringContaining('join public.profiles'),
      ['l1', 'g1'],
    );
  });

  it('upsertMedicalNotes uses ON CONFLICT (learner_id) DO UPDATE and stamps updated_by', async () => {
    const newRow = {
      learner_id: 'l1',
      allergies: 'nuts',
      conditions: '',
      medication: '',
      accommodations: '',
      updated_at: new Date(),
      updated_by: 'admin-1',
    };
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [newRow], rowCount: 1 });
    const repo = new PeopleRepository(makeSp({ executeRaw }));

    const row = await repo.upsertMedicalNotes(
      'l1',
      { allergies: 'nuts' },
      'admin-1',
    );

    expect(row).toEqual(newRow);
    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('on conflict (learner_id) do update');
    expect(values).toEqual(['l1', 'nuts', null, null, null, 'admin-1']);
  });

  it('removeEmergencyContact scopes the DELETE to both learner_id and id', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new PeopleRepository(makeSp({ executeRaw }));

    const rowCount = await repo.removeEmergencyContact('l1', 'contact-1');

    expect(rowCount).toBe(1);
    expect(executeRaw).toHaveBeenCalledWith(
      expect.stringContaining('where learner_id = $1 and id = $2'),
      ['l1', 'contact-1'],
    );
  });
});
