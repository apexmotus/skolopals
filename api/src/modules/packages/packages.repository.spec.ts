import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { PackagesRepository } from './packages.repository.js';

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

describe('PackagesRepository', () => {
  it('listActive filters to is_active', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new PackagesRepository(makeSp({ selectMany }));

    await repo.listActive();

    expect(selectMany).toHaveBeenCalledWith(
      expect.stringContaining('where is_active'),
    );
  });

  it('listAll has no filter', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const repo = new PackagesRepository(makeSp({ selectMany }));

    await repo.listAll();

    expect(selectMany).toHaveBeenCalledWith(
      expect.not.stringContaining('where'),
    );
  });

  it('getPriceOn calls the existing package_price_on function', async () => {
    const queryOne = vi.fn().mockResolvedValue({ package_price_on: 85000 });
    const repo = new PackagesRepository(makeSp({ queryOne }));

    const cents = await repo.getPriceOn('group_1', '2026-11-07');

    expect(cents).toBe(85000);
    expect(queryOne).toHaveBeenCalledWith('public.package_price_on', [
      { name: 'p_package_code', value: 'group_1' },
      { name: 'p_on', value: '2026-11-07' },
    ]);
  });

  it('getPriceOn returns undefined when nothing is in effect', async () => {
    const queryOne = vi.fn().mockResolvedValue({ package_price_on: null });
    const repo = new PackagesRepository(makeSp({ queryOne }));

    await expect(
      repo.getPriceOn('group_1', '2020-01-01'),
    ).resolves.toBeUndefined();
  });

  it('today reads current_date via a plain select (no params, no app-layer tz math)', async () => {
    const selectOne = vi.fn().mockResolvedValue({ today: '2026-11-07' });
    const repo = new PackagesRepository(makeSp({ selectOne }));

    await expect(repo.today()).resolves.toBe('2026-11-07');
    expect(selectOne).toHaveBeenCalledWith('select current_date as today');
  });

  it('getBillingSettingsEffectiveOn filters by the date range', async () => {
    const selectOne = vi.fn().mockResolvedValue(undefined);
    const repo = new PackagesRepository(makeSp({ selectOne }));

    await repo.getBillingSettingsEffectiveOn('2026-11-07');

    expect(selectOne).toHaveBeenCalledWith(
      expect.stringContaining('effective_from'),
      ['2026-11-07'],
    );
  });
});
