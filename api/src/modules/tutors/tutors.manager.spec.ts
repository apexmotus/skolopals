import { NotFoundException } from '@nestjs/common';
import type { CacheService } from '../../common/cache/cache.service';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import type { FileStorageService } from '../../common/file-storage/file-storage.service';
import type { UnitOfWork } from '../../database/unit-of-work';
import { TutorsManager } from './tutors.manager';
import type { TutorsRepository } from './tutors.repository';

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

const TUTOR_ROW = {
  id: 't1',
  profile_id: 'profile-1',
  slug: 'maya-thompson',
  headline: 'Maths specialist',
  bio: '',
  employment_type: 'sessional',
  status: 'active',
  photo_url: null,
  started_on: '2026-01-01',
  ended_on: null,
  created_at: new Date(),
};

describe('TutorsManager — create_tutor BR-23 remap', () => {
  it('remaps the "no account exists" business-rule error to NotFoundException', async () => {
    const repo = {
      createTutor: vi
        .fn()
        .mockRejectedValue(
          new BusinessRuleException(
            'BUSINESS_RULE_VIOLATION',
            'No account exists for x@test.',
          ),
        ),
    } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      makeCache() as unknown as CacheService,
      makeUow(),
      {} as FileStorageService,
    );

    await expect(
      manager.createTutor({
        email: 'x@test',
        slug: 'x',
        employmentType: 'sessional',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('re-reads and returns the full tutor row on success', async () => {
    const repo = {
      createTutor: vi.fn().mockResolvedValue('t1'),
      getById: vi.fn().mockResolvedValue(TUTOR_ROW),
    } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      makeCache() as unknown as CacheService,
      makeUow(),
      {} as FileStorageService,
    );

    const dto = await manager.createTutor({
      email: 'maya@test',
      slug: 'maya-thompson',
      employmentType: 'sessional',
    });

    expect(dto).toMatchObject({ id: 't1', slug: 'maya-thompson' });
  });
});

describe('TutorsManager — caching', () => {
  it('getBySlug caches on a miss, including the rating', async () => {
    const cache = makeCache();
    const repo = {
      getBySlug: vi.fn().mockResolvedValue(TUTOR_ROW),
      getRating: vi
        .fn()
        .mockResolvedValue({
          tutor_id: 't1',
          review_count: '4',
          rating: '4.5',
        }),
    } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      cache as unknown as CacheService,
      makeUow(),
      {} as FileStorageService,
    );

    const dto = await manager.getBySlug('maya-thompson');

    expect(dto.rating).toBe(4.5);
    expect(dto.reviewCount).toBe(4);
    expect(cache.set).toHaveBeenCalledWith(
      'skolopals:tutors:bySlug:maya-thompson',
      dto,
      300,
    );
  });

  it('getBySlug returns the cached value without hitting the repository again', async () => {
    const cache = makeCache();
    cache.store.set('skolopals:tutors:bySlug:maya-thompson', {
      id: 't1',
      slug: 'maya-thompson',
    });
    const getBySlug = vi.fn();
    const repo = { getBySlug } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      cache as unknown as CacheService,
      makeUow(),
      {} as FileStorageService,
    );

    await manager.getBySlug('maya-thompson');

    expect(getBySlug).not.toHaveBeenCalled();
  });

  it('getBySlug 404s when the tutor does not exist', async () => {
    const repo = {
      getBySlug: vi.fn().mockResolvedValue(undefined),
    } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      makeCache() as unknown as CacheService,
      makeUow(),
      {} as FileStorageService,
    );

    await expect(manager.getBySlug('nobody')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("updateMyProfile invalidates that tutor's bySlug cache", async () => {
    const cache = makeCache();
    cache.store.set('skolopals:tutors:bySlug:maya-thompson', { stale: true });
    const repo = {
      updateMyProfile: vi.fn().mockResolvedValue(TUTOR_ROW),
    } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      cache as unknown as CacheService,
      makeUow(),
      {} as FileStorageService,
    );

    await manager.updateMyProfile(
      { id: 'profile-1', roles: ['tutor'], claims: {} },
      { headline: 'New' },
    );

    expect(cache.store.has('skolopals:tutors:bySlug:maya-thompson')).toBe(
      false,
    );
  });

  it("setCompetency invalidates that tutor's competencies cache", async () => {
    const cache = makeCache();
    cache.store.set('skolopals:tutors:competencies:t1', [{ stale: true }]);
    const competencyRow = {
      id: 'c1',
      tutor_id: 't1',
      subject_code: 'mathematics',
      grade_code: 'grade_7',
      media_language_codes: ['english'],
    };
    const repo = {
      setCompetency: vi.fn().mockResolvedValue('c1'),
      getCompetencyById: vi.fn().mockResolvedValue(competencyRow),
    } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      cache as unknown as CacheService,
      makeUow(),
      {} as FileStorageService,
    );

    await manager.setCompetency('t1', {
      subjectCode: 'mathematics',
      gradeCode: 'grade_7',
      mediaLanguageCodes: ['english'],
    });

    expect(cache.store.has('skolopals:tutors:competencies:t1')).toBe(false);
  });
});

describe('TutorsManager — setSpokenLanguages (clear + insert inside one UnitOfWork)', () => {
  it('clears then inserts within the same transaction, then returns the new list', async () => {
    const order: string[] = [];
    const uow = {
      run: vi.fn((fn: () => Promise<unknown>) => fn()),
    } as unknown as UnitOfWork;
    const repo = {
      clearSpokenLanguages: vi.fn().mockImplementation(() => {
        order.push('clear');
        return Promise.resolve();
      }),
      insertSpokenLanguages: vi.fn().mockImplementation(() => {
        order.push('insert');
        return Promise.resolve();
      }),
      listSpokenLanguages: vi
        .fn()
        .mockResolvedValue([{ tutor_id: 't1', language_code: 'english' }]),
    } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      makeCache() as unknown as CacheService,
      uow,
      {} as FileStorageService,
    );

    const dtos = await manager.setSpokenLanguages('t1', {
      languageCodes: ['english'],
    });

    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['clear', 'insert']);
    expect(dtos).toEqual([{ languageCode: 'english' }]);
  });
});

describe('TutorsManager — vetting documents (never proxy bytes)', () => {
  it('uploadDocument gets a signed upload URL and records the storage path, never the file bytes', async () => {
    const createUploadUrl = vi
      .fn()
      .mockResolvedValue({
        signedUrl: 'https://storage/signed',
        token: 'tok',
        path: 'p',
      });
    const fileStorage = { createUploadUrl } as unknown as FileStorageService;
    const documentRow = {
      id: 'd1',
      tutor_id: 't1',
      doc_type: 'id',
      storage_path: 'ignored',
      uploaded_at: new Date(),
      verified_at: null,
      verified_by: null,
    };
    const repo = {
      createDocumentRecord: vi.fn().mockResolvedValue(documentRow),
    } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      makeCache() as unknown as CacheService,
      makeUow(),
      fileStorage,
    );

    const result = await manager.uploadDocument('t1', {
      docType: 'id',
      fileName: 'id-doc.pdf',
    });

    expect(result.uploadUrl).toBe('https://storage/signed');
    expect(createUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^t1\/id\/.+\.pdf$/),
    );
    expect(repo.createDocumentRecord).toHaveBeenCalledWith(
      't1',
      'id',
      expect.stringMatching(/^t1\/id\/.+\.pdf$/),
    );
  });

  it('listDocuments attaches a signed download URL to every row', async () => {
    const createDownloadUrl = vi
      .fn()
      .mockResolvedValue('https://storage/download');
    const fileStorage = { createDownloadUrl } as unknown as FileStorageService;
    const documentRow = {
      id: 'd1',
      tutor_id: 't1',
      doc_type: 'id',
      storage_path: 't1/id/x.pdf',
      uploaded_at: new Date(),
      verified_at: null,
      verified_by: null,
    };
    const repo = {
      listDocuments: vi.fn().mockResolvedValue([documentRow]),
    } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      makeCache() as unknown as CacheService,
      makeUow(),
      fileStorage,
    );

    const dtos = await manager.listDocuments('t1');

    expect(dtos[0]?.downloadUrl).toBe('https://storage/download');
    expect(createDownloadUrl).toHaveBeenCalledWith('t1/id/x.pdf');
  });
});

describe('TutorsManager — references', () => {
  it('recordOutcome 404s when the reference does not belong to the tutor', async () => {
    const repo = {
      recordReferenceOutcome: vi.fn().mockResolvedValue(undefined),
    } as unknown as TutorsRepository;
    const manager = new TutorsManager(
      repo,
      makeCache() as unknown as CacheService,
      makeUow(),
      {} as FileStorageService,
    );

    await expect(
      manager.recordOutcome(
        't1',
        'missing-ref',
        { id: 'admin-1', roles: ['admin'], claims: {} },
        { outcome: 'positive' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
