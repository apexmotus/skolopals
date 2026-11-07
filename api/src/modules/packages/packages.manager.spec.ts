import { NotFoundException } from '@nestjs/common';
import type { CacheService } from '../../common/cache/cache.service';
import { PackagesManager } from './packages.manager';
import type { PackagesRepository } from './packages.repository';

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

const PACKAGE_ROW = {
  code: 'group_1',
  name: 'Group 1',
  description: '',
  service_type: 'group',
  billing_period: 'monthly',
  subject_allowance: 2,
  is_active: true,
  sort_order: 1,
};

describe('PackagesManager — listPackages: admin sees all, everyone else sees active-only', () => {
  it('returns every package for an admin actor, uncached', async () => {
    const listAll = vi
      .fn()
      .mockResolvedValue([
        PACKAGE_ROW,
        { ...PACKAGE_ROW, code: 'inactive_1', is_active: false },
      ]);
    const repo = { listAll } as unknown as PackagesRepository;
    const manager = new PackagesManager(
      repo,
      makeCache() as unknown as CacheService,
    );

    const dtos = await manager.listPackages({
      id: 'admin-1',
      roles: ['admin'],
      claims: {},
    });

    expect(dtos).toHaveLength(2);
    expect(listAll).toHaveBeenCalledTimes(1);
  });

  it('returns active-only, cached, for an anonymous caller', async () => {
    const cache = makeCache();
    const listActive = vi.fn().mockResolvedValue([PACKAGE_ROW]);
    const repo = { listActive } as unknown as PackagesRepository;
    const manager = new PackagesManager(repo, cache as unknown as CacheService);

    const dtos = await manager.listPackages(undefined);

    expect(dtos).toEqual([expect.objectContaining({ code: 'group_1' })]);
    expect(cache.set).toHaveBeenCalledWith(
      'skolopals:packages:listActive',
      dtos,
      300,
    );
  });

  it('returns active-only for a signed-in non-admin actor (a tutor cannot see inactive packages)', async () => {
    const listActive = vi.fn().mockResolvedValue([PACKAGE_ROW]);
    const listAll = vi.fn();
    const repo = { listActive, listAll } as unknown as PackagesRepository;
    const manager = new PackagesManager(
      repo,
      makeCache() as unknown as CacheService,
    );

    await manager.listPackages({ id: 'tutor-1', roles: ['tutor'], claims: {} });

    expect(listActive).toHaveBeenCalledTimes(1);
    expect(listAll).not.toHaveBeenCalled();
  });
});

describe('PackagesManager — getPriceOn', () => {
  it('resolves "today" from the repository when no date is given, then caches by that resolved date', async () => {
    const cache = makeCache();
    const today = vi.fn().mockResolvedValue('2026-11-07');
    const getPriceOn = vi.fn().mockResolvedValue(85000);
    const repo = { today, getPriceOn } as unknown as PackagesRepository;
    const manager = new PackagesManager(repo, cache as unknown as CacheService);

    const cents = await manager.getPriceOn('group_1');

    expect(cents).toBe(85000);
    expect(getPriceOn).toHaveBeenCalledWith('group_1', '2026-11-07');
    expect(
      cache.store.has('skolopals:packages:priceOn:group_1:2026-11-07'),
    ).toBe(true);
  });

  it('404s when nothing is in effect on that date', async () => {
    const repo = {
      today: vi.fn().mockResolvedValue('2026-11-07'),
      getPriceOn: vi.fn().mockResolvedValue(undefined),
    } as unknown as PackagesRepository;
    const manager = new PackagesManager(
      repo,
      makeCache() as unknown as CacheService,
    );

    await expect(
      manager.getPriceOn('group_1', '2020-01-01'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('serves a cached price without calling the repository again', async () => {
    const cache = makeCache();
    cache.store.set('skolopals:packages:priceOn:group_1:2026-11-07', 85000);
    const getPriceOn = vi.fn();
    const repo = { getPriceOn } as unknown as PackagesRepository;
    const manager = new PackagesManager(repo, cache as unknown as CacheService);

    await manager.getPriceOn('group_1', '2026-11-07');

    expect(getPriceOn).not.toHaveBeenCalled();
  });
});

describe('PackagesManager — cache invalidation on write', () => {
  it('create invalidates the active-list cache', async () => {
    const cache = makeCache();
    cache.store.set('skolopals:packages:listActive', [{ stale: true }]);
    const repo = {
      create: vi.fn().mockResolvedValue(PACKAGE_ROW),
    } as unknown as PackagesRepository;
    const manager = new PackagesManager(repo, cache as unknown as CacheService);

    await manager.create({
      code: 'group_1',
      name: 'Group 1',
      serviceType: 'group',
      billingPeriod: 'monthly',
      sortOrder: 1,
    });

    expect(cache.store.has('skolopals:packages:listActive')).toBe(false);
  });
});

describe('PackagesManager — billing settings', () => {
  it('404s when nothing is in effect today', async () => {
    const repo = {
      today: vi.fn().mockResolvedValue('2026-11-07'),
      getBillingSettingsEffectiveOn: vi.fn().mockResolvedValue(undefined),
    } as unknown as PackagesRepository;
    const manager = new PackagesManager(
      repo,
      makeCache() as unknown as CacheService,
    );

    await expect(manager.getCurrentBillingSettings()).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
