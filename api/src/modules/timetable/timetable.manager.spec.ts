import { NotFoundException } from '@nestjs/common';
import type { CacheService } from '../../common/cache/cache.service';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import type { UnitOfWork } from '../../database/unit-of-work';
import { TimetableManager } from './timetable.manager';
import type { TimetableRepository } from './timetable.repository';

function makeCache() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: vi.fn((...keys: string[]) => {
      for (const key of keys) store.delete(key);
      return Promise.resolve();
    }),
    store,
  };
}

function makeUow(): UnitOfWork {
  return {
    run: vi.fn((fn: () => Promise<unknown>) => fn()),
  } as unknown as UnitOfWork;
}

const CLASS_GROUP_ROW = {
  id: 'cg-1',
  name: 'Grade 7 Maths',
  subject_code: 'mathematics',
  language_code: 'english',
  tutor_id: 't-1',
  term_id: 'term-1',
  delivery_mode: 'in_centre',
  room_id: 'room-1',
  capacity: 10,
  is_active: true,
  created_at: new Date(),
};

describe('TimetableManager — createClassGroup (tutor-competency pre-check)', () => {
  it('rejects with a BusinessRuleException naming the missing grade, before writing anything', async () => {
    const findMissingCompetencies = vi.fn().mockResolvedValue(['grade_9']);
    const insertClassGroup = vi.fn();
    const repo = {
      findMissingCompetencies,
      insertClassGroup,
    } as unknown as TimetableRepository;
    const manager = new TimetableManager(
      repo,
      makeCache() as unknown as CacheService,
      makeUow(),
    );

    const createDto = {
      name: 'Grade 9 Maths',
      subjectCode: 'mathematics',
      languageCode: 'english',
      tutorId: 't-1',
      termId: 'term-1',
      deliveryMode: 'in_centre',
      roomId: 'room-1',
      capacity: 10,
      gradeCodes: ['grade_9'],
    };
    await expect(manager.createClassGroup(createDto)).rejects.toBeInstanceOf(
      BusinessRuleException,
    );
    await expect(manager.createClassGroup(createDto)).rejects.toMatchObject({
      message: expect.stringContaining('grade_9'),
    });
    expect(insertClassGroup).not.toHaveBeenCalled();
  });

  it('inserts the class group and its grades inside one UnitOfWork when the tutor is competent', async () => {
    const order: string[] = [];
    const findMissingCompetencies = vi.fn().mockResolvedValue([]);
    const insertClassGroup = vi.fn(() => {
      order.push('insertClassGroup');
      return Promise.resolve(CLASS_GROUP_ROW);
    });
    const insertClassGroupGrades = vi.fn(() => {
      order.push('insertClassGroupGrades');
      return Promise.resolve();
    });
    const repo = {
      findMissingCompetencies,
      insertClassGroup,
      insertClassGroupGrades,
    } as unknown as TimetableRepository;
    const uow = makeUow();
    const manager = new TimetableManager(repo, makeCache() as unknown as CacheService, uow);

    const dto = await manager.createClassGroup({
      name: 'Grade 7 Maths',
      subjectCode: 'mathematics',
      languageCode: 'english',
      tutorId: 't-1',
      termId: 'term-1',
      deliveryMode: 'in_centre',
      roomId: 'room-1',
      capacity: 10,
      gradeCodes: ['grade_7'],
    });

    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['insertClassGroup', 'insertClassGroupGrades']);
    expect(dto).toMatchObject({ id: 'cg-1', gradeCodes: ['grade_7'] });
  });
});

describe('TimetableManager — updateClassGroup', () => {
  it('skips the competency check entirely when none of subject/language/tutor/grades change', async () => {
    const getClassGroupById = vi.fn().mockResolvedValue(CLASS_GROUP_ROW);
    const findMissingCompetencies = vi.fn();
    const updateClassGroup = vi.fn().mockResolvedValue({ ...CLASS_GROUP_ROW, capacity: 15 });
    const listGradeCodes = vi.fn().mockResolvedValue(['grade_7']);
    const repo = {
      getClassGroupById,
      findMissingCompetencies,
      updateClassGroup,
      listGradeCodes,
    } as unknown as TimetableRepository;
    const manager = new TimetableManager(repo, makeCache() as unknown as CacheService, makeUow());

    const dto = await manager.updateClassGroup('cg-1', { capacity: 15 });

    expect(findMissingCompetencies).not.toHaveBeenCalled();
    expect(dto.capacity).toBe(15);
  });

  it('re-checks competency against the EFFECTIVE grade set when only the tutor changes', async () => {
    const getClassGroupById = vi.fn().mockResolvedValue(CLASS_GROUP_ROW);
    const findMissingCompetencies = vi.fn().mockResolvedValue(['grade_7']);
    const listGradeCodes = vi.fn().mockResolvedValue(['grade_7']);
    const repo = {
      getClassGroupById,
      findMissingCompetencies,
      listGradeCodes,
      updateClassGroup: vi.fn(),
    } as unknown as TimetableRepository;
    const manager = new TimetableManager(repo, makeCache() as unknown as CacheService, makeUow());

    await expect(
      manager.updateClassGroup('cg-1', { tutorId: 't-2' }),
    ).rejects.toBeInstanceOf(BusinessRuleException);

    expect(findMissingCompetencies).toHaveBeenCalledWith({
      tutorId: 't-2',
      subjectCode: CLASS_GROUP_ROW.subject_code,
      languageCode: CLASS_GROUP_ROW.language_code,
      gradeCodes: ['grade_7'],
    });
  });

  it('404s when the class group does not exist', async () => {
    const repo = {
      getClassGroupById: vi.fn().mockResolvedValue(undefined),
    } as unknown as TimetableRepository;
    const manager = new TimetableManager(repo, makeCache() as unknown as CacheService, makeUow());

    await expect(manager.updateClassGroup('missing', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('TimetableManager — listClassGroups / getClassGroupById caching', () => {
  it('caches the unfiltered list for a non-admin caller', async () => {
    const cache = makeCache();
    const listClassGroups = vi.fn().mockResolvedValue([CLASS_GROUP_ROW]);
    const listGradeCodesForMany = vi.fn().mockResolvedValue(new Map([['cg-1', ['grade_7']]]));
    const repo = { listClassGroups, listGradeCodesForMany } as unknown as TimetableRepository;
    const manager = new TimetableManager(repo, cache as unknown as CacheService, makeUow());

    await manager.listClassGroups({}, { id: 'parent-1', roles: ['parent'], claims: {} });

    expect(cache.store.has('skolopals:timetable:classGroups:listActive')).toBe(true);
  });

  it('never caches for an admin caller, since an admin sees inactive classes too', async () => {
    const cache = makeCache();
    const listClassGroups = vi.fn().mockResolvedValue([CLASS_GROUP_ROW]);
    const listGradeCodesForMany = vi.fn().mockResolvedValue(new Map());
    const repo = { listClassGroups, listGradeCodesForMany } as unknown as TimetableRepository;
    const manager = new TimetableManager(repo, cache as unknown as CacheService, makeUow());

    await manager.listClassGroups({}, { id: 'admin-1', roles: ['admin'], claims: {} });

    expect(cache.store.has('skolopals:timetable:classGroups:listActive')).toBe(false);
  });

  it('getClassGroupById 404s when the repository returns nothing (RLS hid an inactive class from a non-admin)', async () => {
    const repo = {
      getClassGroupById: vi.fn().mockResolvedValue(undefined),
    } as unknown as TimetableRepository;
    const manager = new TimetableManager(repo, makeCache() as unknown as CacheService, makeUow());

    await expect(
      manager.getClassGroupById('missing', undefined),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TimetableManager — removeSchedule / withdraw: 404 on a no-op write', () => {
  it('removeSchedule 404s when nothing was deleted', async () => {
    const repo = { removeSchedule: vi.fn().mockResolvedValue(0) } as unknown as TimetableRepository;
    const manager = new TimetableManager(repo, makeCache() as unknown as CacheService, makeUow());

    await expect(manager.removeSchedule('cg-1', 'sched-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('withdraw 404s when the placement is already withdrawn or does not exist', async () => {
    const repo = {
      withdrawPlacement: vi.fn().mockResolvedValue(undefined),
    } as unknown as TimetableRepository;
    const manager = new TimetableManager(repo, makeCache() as unknown as CacheService, makeUow());

    await expect(manager.withdraw('cg-1', 'placement-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
