import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { ProgrammesRepository } from './programmes.repository.js';

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

describe('ProgrammesRepository.listProgrammes', () => {
  it('has no WHERE clause — RLS does the published-vs-all filtering', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new ProgrammesRepository(makeSp({ selectMany }));

    await repo.listProgrammes();

    const [sql] = selectMany.mock.calls[0] as [string];
    expect(sql).not.toContain('where');
  });
});

describe('ProgrammesRepository.updateProgramme', () => {
  it('builds a SET clause only for the provided fields, with the id last', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [{ id: 'p-1' }], rowCount: 1 });
    const repo = new ProgrammesRepository(makeSp({ executeRaw }));

    await repo.updateProgramme('p-1', { isPublished: true, capacity: 10 });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('capacity = $1');
    expect(sql).toContain('is_published = $2');
    expect(sql).toContain('where id = $3');
    expect(values).toEqual([10, true, 'p-1']);
  });

  it('re-reads instead of issuing an empty UPDATE when the patch is empty', async () => {
    const getProgrammeById = vi.fn().mockResolvedValue({ id: 'p-1' });
    const executeRaw = vi.fn();
    const repo = new ProgrammesRepository(makeSp({ executeRaw }));
    repo.getProgrammeById = getProgrammeById;

    await repo.updateProgramme('p-1', {});

    expect(executeRaw).not.toHaveBeenCalled();
    expect(getProgrammeById).toHaveBeenCalledWith('p-1');
  });
});

describe('ProgrammesRepository.bookProgramme', () => {
  it('never pre-checks capacity — relies entirely on the DB trigger under lock', async () => {
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'pe-1' }], rowCount: 1 });
    const repo = new ProgrammesRepository(makeSp({ executeRaw }));

    await repo.bookProgramme('p-1', 'l-1');

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('insert into public.programme_enrolments');
    expect(values).toEqual(['p-1', 'l-1']);
  });
});

describe('ProgrammesRepository.cancelBooking', () => {
  it('only cancels a currently-booked row, scoped to both the enrolment id and the programme', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new ProgrammesRepository(makeSp({ executeRaw }));

    await repo.cancelBooking('p-1', 'pe-1');

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status = 'booked'");
    expect(sql).toContain('where id = $1 and programme_id = $2');
    expect(values).toEqual(['pe-1', 'p-1']);
  });
});

describe('ProgrammesRepository.markAttendance', () => {
  it('inserts with the marker as marked_by and defaults note to empty', async () => {
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'pa-1' }], rowCount: 1 });
    const repo = new ProgrammesRepository(makeSp({ executeRaw }));

    await repo.markAttendance({
      programmeSessionId: 'ps-1',
      learnerId: 'l-1',
      status: 'present',
      markedBy: 'tutor-profile-1',
    });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("coalesce($5, '')");
    expect(values).toEqual(['ps-1', 'l-1', 'present', 'tutor-profile-1', null]);
  });
});
