import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { UserRolesRepository } from './user-roles.repository.js';

describe('UserRolesRepository', () => {
  it('selects role names for exactly the given user id', async () => {
    const selectMany = vi
      .fn()
      .mockResolvedValue([{ role: 'parent' }, { role: 'tutor' }]);
    const sp = { selectMany } as unknown as StoredProcRunner;
    const repo = new UserRolesRepository(sp);

    const roles = await repo.listForUser('user-1');

    expect(roles).toEqual(['parent', 'tutor']);
    expect(selectMany).toHaveBeenCalledWith(
      'select role from public.user_roles where user_id = $1',
      ['user-1'],
    );
  });

  it('returns an empty array for a user with no roles', async () => {
    const selectMany = vi.fn().mockResolvedValue([]);
    const sp = { selectMany } as unknown as StoredProcRunner;
    const repo = new UserRolesRepository(sp);

    await expect(repo.listForUser('user-2')).resolves.toEqual([]);
  });
});
