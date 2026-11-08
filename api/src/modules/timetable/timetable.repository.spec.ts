import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { TimetableRepository } from './timetable.repository.js';

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

describe('TimetableRepository.listClassGroups', () => {
  it('has no WHERE clause with no filters', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new TimetableRepository(makeSp({ selectMany }));

    await repo.listClassGroups({});

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('where');
    expect(values).toEqual([]);
  });

  it('filters by both termId and tutorId when given, at the correct param positions', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new TimetableRepository(makeSp({ selectMany }));

    await repo.listClassGroups({ termId: 'term-1', tutorId: 'tutor-1' });

    const [sql, values] = selectMany.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('term_id = $1');
    expect(sql).toContain('tutor_id = $2');
    expect(values).toEqual(['term-1', 'tutor-1']);
  });
});

describe('TimetableRepository.findMissingCompetencies', () => {
  it('passes the grade codes as an array, then tutor/subject/language', async () => {
    const selectMany = vi
      .fn()
      .mockResolvedValue([{ grade_code: 'grade_9' }]);
    const repo = new TimetableRepository(makeSp({ selectMany }));

    const missing = await repo.findMissingCompetencies({
      tutorId: 't-1',
      subjectCode: 'mathematics',
      languageCode: 'english',
      gradeCodes: ['grade_7', 'grade_9'],
    });

    expect(missing).toEqual(['grade_9']);
    expect(selectMany).toHaveBeenCalledWith(expect.any(String), [
      ['grade_7', 'grade_9'],
      't-1',
      'mathematics',
      'english',
    ]);
  });
});

describe('TimetableRepository.updateClassGroup', () => {
  it('builds a SET clause only for the provided fields, with the id last', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [{ id: 'cg-1' }], rowCount: 1 });
    const repo = new TimetableRepository(makeSp({ executeRaw }));

    await repo.updateClassGroup('cg-1', { capacity: 15, isActive: false });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('capacity = $1');
    expect(sql).toContain('is_active = $2');
    expect(sql).toContain('where id = $3');
    expect(values).toEqual([15, false, 'cg-1']);
  });

  it('re-reads instead of issuing an empty UPDATE when the patch is empty', async () => {
    const getClassGroupById = vi.fn().mockResolvedValue({ id: 'cg-1' });
    const executeRaw = vi.fn();
    const repo = new TimetableRepository(makeSp({ executeRaw }));
    repo.getClassGroupById = getClassGroupById;

    await repo.updateClassGroup('cg-1', {});

    expect(executeRaw).not.toHaveBeenCalled();
    expect(getClassGroupById).toHaveBeenCalledWith('cg-1');
  });
});

describe('TimetableRepository.listSessions', () => {
  it('places LIMIT/OFFSET params correctly after dynamic WHERE filters', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new TimetableRepository(makeSp({ executeRaw }));

    await repo.listSessions({
      classGroupId: 'cg-1',
      status: 'scheduled',
      page: 2,
      pageSize: 20,
    });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('class_group_id = $1');
    expect(sql).toContain('status = $2');
    expect(sql).toContain('limit $3 offset $4');
    expect(values).toEqual(['cg-1', 'scheduled', 20, 20]);
  });

  it('computes totalCount from the first row, or 0 for an empty result', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new TimetableRepository(makeSp({ executeRaw }));

    const result = await repo.listSessions({ page: 1, pageSize: 20 });

    expect(result).toEqual({ rows: [], totalCount: 0 });
  });
});

describe('TimetableRepository.generateSessions', () => {
  it('calls the existing generate_class_sessions function', async () => {
    const queryOne = vi.fn().mockResolvedValue({ generate_class_sessions: 12 });
    const repo = new TimetableRepository(makeSp({ queryOne }));

    const count = await repo.generateSessions('cg-1');

    expect(count).toBe(12);
    expect(queryOne).toHaveBeenCalledWith('public.generate_class_sessions', [
      { name: 'p_class_group_id', value: 'cg-1' },
    ]);
  });
});

describe('TimetableRepository.removeSchedule / withdrawPlacement', () => {
  it('removeSchedule scopes the DELETE to both the schedule id and its class group', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new TimetableRepository(makeSp({ executeRaw }));

    const rowCount = await repo.removeSchedule('cg-1', 'sched-1');

    expect(rowCount).toBe(1);
    expect(executeRaw).toHaveBeenCalledWith(expect.any(String), ['sched-1', 'cg-1']);
  });

  it('withdrawPlacement only updates an active (not-already-left) placement', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new TimetableRepository(makeSp({ executeRaw }));

    await repo.withdrawPlacement('cg-1', 'placement-1');

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('left_on is null');
    expect(values).toEqual(['placement-1', 'cg-1']);
  });
});

describe('TimetableRepository.listGradeCodesForMany', () => {
  it('returns an empty map without querying when given no ids', async () => {
    const selectMany = vi.fn();
    const repo = new TimetableRepository(makeSp({ selectMany }));

    const map = await repo.listGradeCodesForMany([]);

    expect(map.size).toBe(0);
    expect(selectMany).not.toHaveBeenCalled();
  });

  it('groups grade codes by class_group_id', async () => {
    const selectMany = vi.fn().mockResolvedValue([
      { class_group_id: 'cg-1', grade_code: 'grade_7' },
      { class_group_id: 'cg-1', grade_code: 'grade_8' },
      { class_group_id: 'cg-2', grade_code: 'grade_9' },
    ]);
    const repo = new TimetableRepository(makeSp({ selectMany }));

    const map = await repo.listGradeCodesForMany(['cg-1', 'cg-2']);

    expect(map.get('cg-1')).toEqual(['grade_7', 'grade_8']);
    expect(map.get('cg-2')).toEqual(['grade_9']);
  });
});
