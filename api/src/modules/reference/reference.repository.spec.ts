import type { StoredProcRunner } from '../../database/stored-proc.runner';
import { ReferenceRepository } from './reference.repository';

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

describe('ReferenceRepository', () => {
  it('listPhases selects every school_phases row ordered by sort_order', async () => {
    const selectMany = vi
      .fn()
      .mockResolvedValue([
        { code: 'foundation', name: 'Foundation Phase', sort_order: 1 },
      ]);
    const repo = new ReferenceRepository(makeSp({ selectMany }));

    const rows = await repo.listPhases();

    expect(rows).toEqual([
      { code: 'foundation', name: 'Foundation Phase', sort_order: 1 },
    ]);
    expect(selectMany).toHaveBeenCalledWith(
      'select code, name, sort_order from public.school_phases order by sort_order',
    );
  });

  it('listOfferings with no gradeCode selects every row', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ReferenceRepository(makeSp({ selectMany }));

    await repo.listOfferings(null);

    expect(selectMany).toHaveBeenCalledWith(
      'select subject_code, grade_code from public.subject_offerings order by grade_code, subject_code',
    );
  });

  it('listOfferings with a gradeCode filters by it', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ReferenceRepository(makeSp({ selectMany }));

    await repo.listOfferings('grade_7');

    expect(selectMany).toHaveBeenCalledWith(
      'select subject_code, grade_code from public.subject_offerings where grade_code = $1 order by subject_code',
      ['grade_7'],
    );
  });

  it('createTerm inserts and returns the new row', async () => {
    const newRow = {
      id: 't1',
      year: 2027,
      term_number: 1,
      starts_on: '2027-01-13',
      ends_on: '2027-03-19',
      created_at: new Date(),
    };
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [newRow], rowCount: 1 });
    const repo = new ReferenceRepository(makeSp({ executeRaw }));

    const row = await repo.createTerm({
      year: 2027,
      termNumber: 1,
      startsOn: '2027-01-13',
      endsOn: '2027-03-19',
    });

    expect(row).toEqual(newRow);
    expect(executeRaw).toHaveBeenCalledWith(
      expect.stringContaining('insert into public.terms'),
      [2027, 1, '2027-01-13', '2027-03-19'],
    );
  });

  it('createTerm throws if the INSERT ... RETURNING unexpectedly returns no row', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new ReferenceRepository(makeSp({ executeRaw }));

    await expect(
      repo.createTerm({
        year: 2027,
        termNumber: 1,
        startsOn: '2027-01-13',
        endsOn: '2027-03-19',
      }),
    ).rejects.toThrow();
  });

  it('createRoom defaults isActive to true when omitted', async () => {
    const newRow = { id: 'r1', name: 'Room A', capacity: 5, is_active: true };
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [newRow], rowCount: 1 });
    const repo = new ReferenceRepository(makeSp({ executeRaw }));

    await repo.createRoom({ name: 'Room A', capacity: 5 });

    expect(executeRaw).toHaveBeenCalledWith(
      expect.stringContaining('insert into public.rooms'),
      ['Room A', 5, true],
    );
  });
});
