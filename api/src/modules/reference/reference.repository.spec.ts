import type { StoredProcRunner } from '../../database/stored-proc.runner';
import { ReferenceRepository } from './reference.repository';

function makeSp(overrides: Partial<Record<keyof StoredProcRunner, unknown>> = {}): StoredProcRunner {
  return {
    selectMany: vi.fn().mockResolvedValue([]),
    executeRaw: vi.fn().mockResolvedValue({ rows: [{ id: 'x1' }], rowCount: 1 }),
    ...overrides,
  } as unknown as StoredProcRunner;
}

describe('ReferenceRepository.listOfferings', () => {
  it('reads every offering, unfiltered, when gradeCode is null', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ReferenceRepository(makeSp({ selectMany }));

    await repo.listOfferings(null);

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[] | undefined];
    expect(sql).not.toContain('where');
    expect(values ?? []).toEqual([]);
  });

  it('filters by grade_code when one is supplied', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ReferenceRepository(makeSp({ selectMany }));

    await repo.listOfferings('grade_7');

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('where grade_code = $1');
    expect(values).toEqual(['grade_7']);
  });
});

describe('ReferenceRepository.createTerm', () => {
  it('inserts the four term fields and returns the new row', async () => {
    const executeRaw = vi.fn().mockResolvedValue({
      rows: [{ id: 't1', year: 2027, term_number: 1, starts_on: '2027-01-13', ends_on: '2027-03-19' }],
      rowCount: 1,
    });
    const repo = new ReferenceRepository(makeSp({ executeRaw }));

    const row = await repo.createTerm({ year: 2027, termNumber: 1, startsOn: '2027-01-13', endsOn: '2027-03-19' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert into public.terms');
    expect(values).toEqual([2027, 1, '2027-01-13', '2027-03-19']);
    expect(row.id).toBe('t1');
  });

  it('throws if the insert unexpectedly returns no row', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new ReferenceRepository(makeSp({ executeRaw }));

    await expect(
      repo.createTerm({ year: 2027, termNumber: 1, startsOn: '2027-01-13', endsOn: '2027-03-19' }),
    ).rejects.toThrow('INSERT ... RETURNING unexpectedly returned no row');
  });
});

describe('ReferenceRepository.createRoom', () => {
  it('defaults isActive to true when omitted', async () => {
    const executeRaw = vi.fn().mockResolvedValue({
      rows: [{ id: 'r1', name: 'Room A', capacity: 5, is_active: true }],
      rowCount: 1,
    });
    const repo = new ReferenceRepository(makeSp({ executeRaw }));

    await repo.createRoom({ name: 'Room A', capacity: 5 });

    const [, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual(['Room A', 5, true]);
  });

  it('respects an explicit isActive: false', async () => {
    const executeRaw = vi.fn().mockResolvedValue({
      rows: [{ id: 'r1', name: 'Room A', capacity: 5, is_active: false }],
      rowCount: 1,
    });
    const repo = new ReferenceRepository(makeSp({ executeRaw }));

    await repo.createRoom({ name: 'Room A', capacity: 5, isActive: false });

    const [, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual(['Room A', 5, false]);
  });
});

describe('ReferenceRepository — plain reference-table reads', () => {
  it('listPhases reads school_phases ordered by sort_order', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ReferenceRepository(makeSp({ selectMany }));
    await repo.listPhases();
    expect(selectMany.mock.calls[0]?.[0]).toContain('from public.school_phases');
  });

  it('listGrades reads grades ordered by sort_order', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ReferenceRepository(makeSp({ selectMany }));
    await repo.listGrades();
    expect(selectMany.mock.calls[0]?.[0]).toContain('from public.grades');
  });

  it('listAchievementLevels orders by code desc (highest band first)', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ReferenceRepository(makeSp({ selectMany }));
    await repo.listAchievementLevels();
    expect(selectMany.mock.calls[0]?.[0]).toContain('order by code desc');
  });

  it('listConsentTypes selects is_required alongside the rest', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ReferenceRepository(makeSp({ selectMany }));
    await repo.listConsentTypes();
    expect(selectMany.mock.calls[0]?.[0]).toContain('is_required');
  });

  it('listOperatingHours orders by day then opening time', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ReferenceRepository(makeSp({ selectMany }));
    await repo.listOperatingHours();
    expect(selectMany.mock.calls[0]?.[0]).toContain('order by day_of_week, opens_at');
  });
});
