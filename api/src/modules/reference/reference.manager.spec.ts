import type { CacheService } from '../../common/cache/cache.service.js';
import type { ReferenceRepository } from './reference.repository.js';
import { ReferenceManager } from './reference.manager.js';
import { referenceCacheKeys } from './reference-cache-keys.js';

function makeCache(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
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

describe('ReferenceManager', () => {
  it('listGrades caches on a miss and returns mapped DTOs', async () => {
    const cache = makeCache();
    const listGrades = vi.fn().mockResolvedValue([
      {
        code: 'grade_7',
        name: 'Grade 7',
        phase_code: 'senior',
        sort_order: 7,
      },
    ]);
    const repo = { listGrades } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(
      repo,
      cache as unknown as CacheService,
    );

    const dtos = await manager.listGrades();

    expect(dtos).toEqual([
      { code: 'grade_7', name: 'Grade 7', phaseCode: 'senior', sortOrder: 7 },
    ]);
    expect(listGrades).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(
      referenceCacheKeys.grades,
      dtos,
      3600,
    );
  });

  it('listGrades returns the cached value on a hit, without calling the repository', async () => {
    const cached = [
      { code: 'grade_7', name: 'Grade 7', phaseCode: 'senior', sortOrder: 7 },
    ];
    const cache = makeCache({ [referenceCacheKeys.grades]: cached });
    const listGrades = vi.fn();
    const repo = { listGrades } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(
      repo,
      cache as unknown as CacheService,
    );

    const dtos = await manager.listGrades();

    expect(dtos).toBe(cached);
    expect(listGrades).not.toHaveBeenCalled();
  });

  it('listOfferings keys the cache per gradeCode, including the "all" case', async () => {
    const cache = makeCache();
    const listOfferings = vi.fn().mockResolvedValue([]);
    const repo = { listOfferings } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(
      repo,
      cache as unknown as CacheService,
    );

    await manager.listOfferings('grade_7');
    await manager.listOfferings();

    expect(listOfferings).toHaveBeenNthCalledWith(1, 'grade_7');
    expect(listOfferings).toHaveBeenNthCalledWith(2, null);
    expect(
      cache.store.has(referenceCacheKeys.subjectOfferings('grade_7')),
    ).toBe(true);
    expect(cache.store.has(referenceCacheKeys.subjectOfferings(null))).toBe(
      true,
    );
  });

  it('createTerm invalidates the terms cache after writing', async () => {
    const cache = makeCache({ [referenceCacheKeys.terms]: [{ stale: true }] });
    const createTerm = vi.fn().mockResolvedValue({
      id: 't1',
      year: 2027,
      term_number: 1,
      starts_on: '2027-01-13',
      ends_on: '2027-03-19',
    });
    const repo = { createTerm } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(
      repo,
      cache as unknown as CacheService,
    );

    const dto = await manager.createTerm({
      year: 2027,
      termNumber: 1,
      startsOn: '2027-01-13',
      endsOn: '2027-03-19',
    });

    expect(dto).toEqual({
      id: 't1',
      year: 2027,
      termNumber: 1,
      startsOn: '2027-01-13',
      endsOn: '2027-03-19',
    });
    expect(cache.store.has(referenceCacheKeys.terms)).toBe(false);
  });

  it('createRoom invalidates the rooms cache after writing', async () => {
    const cache = makeCache({ [referenceCacheKeys.rooms]: [{ stale: true }] });
    const createRoom = vi.fn().mockResolvedValue({
      id: 'r1',
      name: 'Room A',
      capacity: 5,
      is_active: true,
    });
    const repo = { createRoom } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(
      repo,
      cache as unknown as CacheService,
    );

    await manager.createRoom({ name: 'Room A', capacity: 5 });

    expect(cache.store.has(referenceCacheKeys.rooms)).toBe(false);
  });

  it('listPhases caches on a miss and maps the row', async () => {
    const cache = makeCache();
    const listPhases = vi.fn().mockResolvedValue([{ code: 'foundation', name: 'Foundation', sort_order: 1 }]);
    const repo = { listPhases } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listPhases();

    expect(dtos).toEqual([{ code: 'foundation', name: 'Foundation', sortOrder: 1 }]);
    expect(cache.store.has(referenceCacheKeys.phases)).toBe(true);
  });

  it('listSubjects caches on a miss and maps the row', async () => {
    const cache = makeCache();
    const listSubjects = vi
      .fn()
      .mockResolvedValue([{ code: 'maths', name: 'Mathematics', description: '', is_language: false, sort_order: 1 }]);
    const repo = { listSubjects } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listSubjects();

    expect(dtos).toEqual([
      { code: 'maths', name: 'Mathematics', description: '', isLanguage: false, sortOrder: 1 },
    ]);
    expect(cache.store.has(referenceCacheKeys.subjects)).toBe(true);
  });

  it('listLanguages caches on a miss and maps the row', async () => {
    const cache = makeCache();
    const listLanguages = vi.fn().mockResolvedValue([{ code: 'english', name: 'English', sort_order: 1 }]);
    const repo = { listLanguages } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listLanguages();

    expect(dtos).toEqual([{ code: 'english', name: 'English', sortOrder: 1 }]);
    expect(cache.store.has(referenceCacheKeys.languages)).toBe(true);
  });

  it('listAchievementLevels caches on a miss and maps the row', async () => {
    const cache = makeCache();
    const listAchievementLevels = vi
      .fn()
      .mockResolvedValue([{ code: 7, label: 'Outstanding', description: '', min_percent: 80, max_percent: 100 }]);
    const repo = { listAchievementLevels } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listAchievementLevels();

    expect(dtos).toEqual([
      { code: 7, label: 'Outstanding', description: '', minPercent: 80, maxPercent: 100 },
    ]);
    expect(cache.store.has(referenceCacheKeys.achievementLevels)).toBe(true);
  });

  it('listAssessmentTypes caches on a miss and maps the row', async () => {
    const cache = makeCache();
    const listAssessmentTypes = vi
      .fn()
      .mockResolvedValue([{ code: 'initial', name: 'Initial', description: '', sort_order: 1 }]);
    const repo = { listAssessmentTypes } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listAssessmentTypes();

    expect(dtos).toEqual([{ code: 'initial', name: 'Initial', description: '', sortOrder: 1 }]);
    expect(cache.store.has(referenceCacheKeys.assessmentTypes)).toBe(true);
  });

  it('listAssessmentDomains caches on a miss and maps the row', async () => {
    const cache = makeCache();
    const listAssessmentDomains = vi
      .fn()
      .mockResolvedValue([{ code: 'reading', name: 'Reading', description: '', sort_order: 1 }]);
    const repo = { listAssessmentDomains } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listAssessmentDomains();

    expect(dtos).toEqual([{ code: 'reading', name: 'Reading', description: '', sortOrder: 1 }]);
    expect(cache.store.has(referenceCacheKeys.assessmentDomains)).toBe(true);
  });

  it('listConsentTypes caches on a miss and maps the row, including isRequired', async () => {
    const cache = makeCache();
    const listConsentTypes = vi.fn().mockResolvedValue([
      {
        code: 'enrolment_s35',
        name: 'Enrolment consent',
        description: '',
        statute_ref: 's35',
        is_required: true,
        sort_order: 1,
      },
    ]);
    const repo = { listConsentTypes } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listConsentTypes();

    expect(dtos).toEqual([
      {
        code: 'enrolment_s35',
        name: 'Enrolment consent',
        description: '',
        statuteRef: 's35',
        isRequired: true,
        sortOrder: 1,
      },
    ]);
    expect(cache.store.has(referenceCacheKeys.consentTypes)).toBe(true);
  });

  it('listDataRetentionPolicies caches on a miss and maps the row', async () => {
    const cache = makeCache();
    const listDataRetentionPolicies = vi.fn().mockResolvedValue([
      {
        record_class: 'learner_records',
        description: "A learner's academic and attendance records",
        retention_months: 60,
        basis: 'POPIA s14',
      },
    ]);
    const repo = {
      listDataRetentionPolicies,
    } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listDataRetentionPolicies();

    expect(dtos).toEqual([
      {
        recordClass: 'learner_records',
        description: "A learner's academic and attendance records",
        retentionMonths: 60,
        basis: 'POPIA s14',
      },
    ]);
    expect(cache.store.has(referenceCacheKeys.dataRetentionPolicies)).toBe(true);
  });

  it('listTerms caches on a miss and maps the row', async () => {
    const cache = makeCache();
    const listTerms = vi
      .fn()
      .mockResolvedValue([{ id: 't1', year: 2027, term_number: 1, starts_on: '2027-01-13', ends_on: '2027-03-19' }]);
    const repo = { listTerms } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listTerms();

    expect(dtos).toEqual([
      { id: 't1', year: 2027, termNumber: 1, startsOn: '2027-01-13', endsOn: '2027-03-19' },
    ]);
    expect(cache.store.has(referenceCacheKeys.terms)).toBe(true);
  });

  it('listOperatingHours caches on a miss and maps the row', async () => {
    const cache = makeCache();
    const listOperatingHours = vi
      .fn()
      .mockResolvedValue([{ day_of_week: 1, opens_at: '13:00', closes_at: '17:00', purpose: 'lessons' }]);
    const repo = { listOperatingHours } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listOperatingHours();

    expect(dtos).toEqual([{ dayOfWeek: 1, opensAt: '13:00', closesAt: '17:00', purpose: 'lessons' }]);
    expect(cache.store.has(referenceCacheKeys.operatingHours)).toBe(true);
  });

  it('listRooms caches on a miss and maps the row', async () => {
    const cache = makeCache();
    const listRooms = vi.fn().mockResolvedValue([{ id: 'r1', name: 'Room A', capacity: 5, is_active: true }]);
    const repo = { listRooms } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listRooms();

    expect(dtos).toEqual([{ id: 'r1', name: 'Room A', capacity: 5, isActive: true }]);
    expect(cache.store.has(referenceCacheKeys.rooms)).toBe(true);
  });

  it('every list* method returns the cached value on a hit, without calling the repository (spot-check on a representative method)', async () => {
    const cached = [{ code: 'maths', name: 'Mathematics', description: '', isLanguage: false, sortOrder: 1 }];
    const cache = makeCache({ [referenceCacheKeys.subjects]: cached });
    const listSubjects = vi.fn();
    const repo = { listSubjects } as unknown as ReferenceRepository;
    const manager = new ReferenceManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listSubjects();

    expect(dtos).toBe(cached);
    expect(listSubjects).not.toHaveBeenCalled();
  });
});
