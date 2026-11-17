import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception.js';
import type { SupabaseAdminAuthService } from '../../common/supabase-admin/supabase-admin-auth.service.js';
import { PeopleManager } from './people.manager.js';
import type { PeopleRepository } from './people.repository.js';

const LEARNER_ROW = {
  id: 'learner-1',
  profile_id: null,
  full_name: 'Learner A',
  date_of_birth: '2013-04-02',
  grade_code: 'grade_7',
  school_name: '',
  home_language_code: null,
  status: 'active',
  joined_on: '2026-01-01',
  left_on: null,
  created_at: new Date(),
};

function makeRepo(
  overrides: Partial<Record<keyof PeopleRepository, unknown>> = {},
): PeopleRepository {
  return {
    canViewLearner: vi.fn().mockResolvedValue(true),
    canViewLearnerPrivate: vi.fn().mockResolvedValue(true),
    getLearnerById: vi.fn().mockResolvedValue(LEARNER_ROW),
    ...overrides,
  } as unknown as PeopleRepository;
}

const admin: AuthUser = {
  id: 'admin-1',
  roles: ['admin'],
  claims: { sub: 'admin-1', email: 'admin@test' },
};

describe('PeopleManager — the POPIA boundary (academic vs. private tier)', () => {
  it('denies a tutor medical notes even though they teach the learner', async () => {
    // A tutor who teaches the learner: canViewLearner=true (academic), canViewLearnerPrivate=false (private tier, tutor excluded).
    const repo = makeRepo({
      canViewLearnerPrivate: vi.fn().mockResolvedValue(false),
    });
    const manager = new PeopleManager(repo);

    await expect(manager.getMedicalNotes('learner-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('denies a tutor the emergency-contacts list even though they teach the learner', async () => {
    const repo = makeRepo({
      canViewLearnerPrivate: vi.fn().mockResolvedValue(false),
    });
    const manager = new PeopleManager(repo);

    await expect(
      manager.listEmergencyContacts('learner-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('denies a tutor the authorised-collectors list even though they teach the learner', async () => {
    const repo = makeRepo({
      canViewLearnerPrivate: vi.fn().mockResolvedValue(false),
    });
    const manager = new PeopleManager(repo);

    await expect(manager.listCollectors('learner-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('grants a tutor the guardians list (non-private data) when they teach the learner', async () => {
    const guardianRow = {
      learner_id: 'learner-1',
      guardian_id: 'guardian-1',
      guardian_name: 'Guardian One',
      guardian_phone: '0820000000',
      relationship: 'mother',
      is_primary: true,
      is_billing_contact: true,
    };
    const repo = makeRepo({
      listGuardians: vi.fn().mockResolvedValue([guardianRow]),
    });
    const manager = new PeopleManager(repo);

    const dtos = await manager.listGuardians('learner-1');

    expect(dtos).toEqual([
      {
        learnerId: 'learner-1',
        guardianId: 'guardian-1',
        guardianName: 'Guardian One',
        guardianPhone: '0820000000',
        relationship: 'mother',
        isPrimary: true,
        isBillingContact: true,
      },
    ]);
  });
});

describe('PeopleManager — guardian isolation', () => {
  it("denies a parent another family's learner (404, never 403)", async () => {
    const repo = makeRepo({ canViewLearner: vi.fn().mockResolvedValue(false) });
    const manager = new PeopleManager(repo);

    await expect(
      manager.getLearnerById('someone-elses-child'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("denies a parent updating another family's learner", async () => {
    const repo = makeRepo({
      canViewLearnerPrivate: vi.fn().mockResolvedValue(false),
    });
    const manager = new PeopleManager(repo);

    await expect(
      manager.updateLearner('someone-elses-child', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PeopleManager — getLearnerById', () => {
  it('returns the mapped learner when entitled', async () => {
    const repo = makeRepo();
    const manager = new PeopleManager(repo);

    const dto = await manager.getLearnerById('learner-1');

    expect(dto).toMatchObject({
      id: 'learner-1',
      fullName: 'Learner A',
      gradeCode: 'grade_7',
      status: 'active',
    });
  });

  it('404s if entitled but the row has since disappeared', async () => {
    const repo = makeRepo({
      getLearnerById: vi.fn().mockResolvedValue(undefined),
    });
    const manager = new PeopleManager(repo);

    await expect(manager.getLearnerById('learner-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PeopleManager — updateLearner status/leftOn invariant', () => {
  it('rejects status "left" without leftOn', async () => {
    const repo = makeRepo();
    const manager = new PeopleManager(repo);

    await expect(
      manager.updateLearner('learner-1', { status: 'left' }),
    ).rejects.toBeInstanceOf(BusinessRuleException);
  });

  it('rejects leftOn without status "left"', async () => {
    const repo = makeRepo();
    const manager = new PeopleManager(repo);

    await expect(
      manager.updateLearner('learner-1', { leftOn: '2026-06-01' }),
    ).rejects.toBeInstanceOf(BusinessRuleException);
  });

  it('accepts status "left" with leftOn together', async () => {
    const updateLearner = vi.fn().mockResolvedValue({
      ...LEARNER_ROW,
      status: 'left',
      left_on: '2026-06-01',
    });
    const repo = makeRepo({ updateLearner });
    const manager = new PeopleManager(repo);

    const dto = await manager.updateLearner('learner-1', {
      status: 'left',
      leftOn: '2026-06-01',
    });

    expect(dto.status).toBe('left');
    expect(updateLearner).toHaveBeenCalledWith(
      'learner-1',
      expect.objectContaining({ status: 'left', leftOn: '2026-06-01' }),
    );
  });

  it('clears leftOn when reactivating a learner away from "left"', async () => {
    const leftRow = { ...LEARNER_ROW, status: 'left', left_on: '2026-01-01' };
    const updateLearner = vi
      .fn()
      .mockResolvedValue({ ...leftRow, status: 'active', left_on: null });
    const repo = makeRepo({
      getLearnerById: vi.fn().mockResolvedValue(leftRow),
      updateLearner,
    });
    const manager = new PeopleManager(repo);

    await manager.updateLearner('learner-1', { status: 'active' });

    expect(updateLearner).toHaveBeenCalledWith(
      'learner-1',
      expect.objectContaining({ status: 'active', leftOn: null }),
    );
  });

  it('leaves status/leftOn untouched when neither is in the patch', async () => {
    const updateLearner = vi.fn().mockResolvedValue(LEARNER_ROW);
    const repo = makeRepo({ updateLearner });
    const manager = new PeopleManager(repo);

    await manager.updateLearner('learner-1', { fullName: 'New Name' });

    expect(updateLearner).toHaveBeenCalledWith(
      'learner-1',
      expect.objectContaining({
        status: 'active',
        leftOn: null,
        fullName: 'New Name',
      }),
    );
  });
});

describe('PeopleManager — profile', () => {
  it('reads the email from the decoded JWT claims, not a DB column', async () => {
    const repo = makeRepo({
      getProfileById: vi.fn().mockResolvedValue({
        id: 'admin-1',
        full_name: 'Admin',
        phone: null,
        created_at: new Date(),
      }),
    });
    const manager = new PeopleManager(repo);

    const dto = await manager.getMyProfile(admin);

    expect(dto.email).toBe('admin@test');
  });

  it("echoes the actor's roles, as resolved by JwtAuthGuard, without a second lookup", async () => {
    const repo = makeRepo({
      getProfileById: vi.fn().mockResolvedValue({
        id: 'admin-1',
        full_name: 'Admin',
        phone: null,
        created_at: new Date(),
      }),
    });
    const manager = new PeopleManager(repo);

    const dto = await manager.getMyProfile(admin);

    expect(dto.roles).toEqual(['admin']);
  });

  it('404s if somehow no profile row exists for the actor', async () => {
    const repo = makeRepo({
      getProfileById: vi.fn().mockResolvedValue(undefined),
    });
    const manager = new PeopleManager(repo);

    await expect(manager.getMyProfile(admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PeopleManager — not-found on write targets', () => {
  it('404s removing an emergency contact that does not exist', async () => {
    const repo = makeRepo({
      removeEmergencyContact: vi.fn().mockResolvedValue(0),
    });
    const manager = new PeopleManager(repo);

    await expect(
      manager.removeEmergencyContact('learner-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s removing a collector that does not exist', async () => {
    const repo = makeRepo({ removeCollector: vi.fn().mockResolvedValue(0) });
    const manager = new PeopleManager(repo);

    await expect(
      manager.removeCollector('learner-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s setting contact flags on a guardian link that does not exist', async () => {
    const repo = makeRepo({
      setContactFlags: vi.fn().mockResolvedValue(undefined),
    });
    const manager = new PeopleManager(repo);

    await expect(
      manager.setContactFlags('learner-1', 'missing-guardian', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PeopleManager — inviteUser & role hierarchy', () => {
  const superadmin: AuthUser = {
    id: 'superadmin-1',
    roles: ['superadmin'],
    claims: { sub: 'superadmin-1', email: 'superadmin@test' },
  };

  const parentActor: AuthUser = {
    id: 'parent-1',
    roles: ['parent'],
    claims: { sub: 'parent-1', email: 'parent@test' },
  };

  function makeAdminAuth(userId = 'invited-user-1'): SupabaseAdminAuthService {
    return {
      inviteUserByEmail: vi.fn().mockResolvedValue({ userId }),
    } as unknown as SupabaseAdminAuthService;
  }

  it('rejects a regular admin attempting to create an admin user (403)', async () => {
    const repo = makeRepo({ configureInvitedUser: vi.fn() });
    const adminAuth = makeAdminAuth();
    const manager = new PeopleManager(repo, adminAuth);

    await expect(
      manager.inviteUser(admin, {
        firstName: 'Lerato',
        lastName: 'Nkosi',
        email: 'lerato@example.com',
        role: 'admin',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(adminAuth.inviteUserByEmail).not.toHaveBeenCalled();
    expect(repo.configureInvitedUser).not.toHaveBeenCalled();
  });

  it('allows a superadmin to create an admin user and sends invitation email', async () => {
    const createdAt = new Date('2026-11-13T12:00:00Z');
    const configureInvitedUser = vi.fn().mockResolvedValue({
      id: 'invited-admin-1',
      first_name: 'Lerato',
      last_name: 'Nkosi',
      full_name: 'Lerato Nkosi',
      email: 'lerato@example.com',
      phone: null,
      roles: ['admin'],
      created_at: createdAt,
    });
    const repo = makeRepo({ configureInvitedUser });
    const adminAuth = makeAdminAuth('invited-admin-1');
    const manager = new PeopleManager(repo, adminAuth);

    const result = await manager.inviteUser(superadmin, {
      firstName: ' Lerato ',
      lastName: ' Nkosi ',
      email: ' Lerato@Example.com ',
      role: 'admin',
    });

    expect(adminAuth.inviteUserByEmail).toHaveBeenCalledWith({
      email: 'lerato@example.com',
      firstName: 'Lerato',
      lastName: 'Nkosi',
      role: 'admin',
    });
    expect(configureInvitedUser).toHaveBeenCalledWith({
      userId: 'invited-admin-1',
      firstName: 'Lerato',
      lastName: 'Nkosi',
      role: 'admin',
    });
    expect(result).toEqual({
      id: 'invited-admin-1',
      firstName: 'Lerato',
      lastName: 'Nkosi',
      fullName: 'Lerato Nkosi',
      email: 'lerato@example.com',
      phone: undefined,
      roles: ['admin'],
      createdAt: createdAt.toISOString(),
    });
  });

  it('allows a regular admin to create a tutor, parent, or learner user', async () => {
    const createdAt = new Date('2026-11-13T12:00:00Z');
    const configureInvitedUser = vi.fn().mockResolvedValue({
      id: 'invited-tutor-1',
      first_name: 'Thabo',
      last_name: 'Mokoena',
      full_name: 'Thabo Mokoena',
      email: 'thabo@example.com',
      phone: null,
      roles: ['tutor'],
      created_at: createdAt,
    });
    const repo = makeRepo({ configureInvitedUser });
    const adminAuth = makeAdminAuth('invited-tutor-1');
    const manager = new PeopleManager(repo, adminAuth);

    const result = await manager.inviteUser(admin, {
      firstName: 'Thabo',
      lastName: 'Mokoena',
      email: 'thabo@example.com',
      role: 'tutor',
    });

    expect(adminAuth.inviteUserByEmail).toHaveBeenCalledWith({
      email: 'thabo@example.com',
      firstName: 'Thabo',
      lastName: 'Mokoena',
      role: 'tutor',
    });
    expect(configureInvitedUser).toHaveBeenCalledWith({
      userId: 'invited-tutor-1',
      firstName: 'Thabo',
      lastName: 'Mokoena',
      role: 'tutor',
    });
    expect(result.roles).toEqual(['tutor']);
  });

  it('rejects assigning superadmin even when called by a superadmin', async () => {
    const repo = makeRepo({ configureInvitedUser: vi.fn() });
    const adminAuth = makeAdminAuth();
    const manager = new PeopleManager(repo, adminAuth);

    await expect(
      manager.inviteUser(superadmin, {
        firstName: 'Sipho',
        lastName: 'Dlamini',
        email: 'sipho@example.com',
        role: 'superadmin' as never,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(adminAuth.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects non-admin callers attempting to invite a user', async () => {
    const repo = makeRepo({ configureInvitedUser: vi.fn() });
    const adminAuth = makeAdminAuth();
    const manager = new PeopleManager(repo, adminAuth);

    await expect(
      manager.inviteUser(parentActor, {
        firstName: 'Child',
        lastName: 'One',
        email: 'child@example.com',
        role: 'learner',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('PeopleManager — updateUser & setUserActive', () => {
  const superadmin: AuthUser = {
    id: 'superadmin-1',
    roles: ['superadmin'],
    claims: { sub: 'superadmin-1', email: 'superadmin@test' },
  };
  const row = (id: string, roles: string[], isActive = true) => ({
    id,
    first_name: 'A',
    last_name: 'B',
    full_name: 'A B',
    email: 'a@b.test',
    phone: null,
    roles,
    is_active: isActive,
    created_at: new Date('2026-11-17T00:00:00Z'),
  });
  const edit = { firstName: 'New', lastName: 'Name', roles: ['tutor' as const] };

  function makeAdminAuth() {
    return { setUserActive: vi.fn().mockResolvedValue(undefined) };
  }

  it('lets an admin edit an ordinary user', async () => {
    const updateUserForAdmin = vi.fn().mockResolvedValue(row('u1', ['tutor']));
    const repo = makeRepo({
      getUserForAdmin: vi.fn().mockResolvedValue(row('u1', ['parent'])),
      updateUserForAdmin,
    });
    const manager = new PeopleManager(repo);

    const result = await manager.updateUser(admin, 'u1', edit);

    expect(updateUserForAdmin).toHaveBeenCalledWith({
      userId: 'u1',
      firstName: 'New',
      lastName: 'Name',
      roles: ['tutor'],
    });
    expect(result.roles).toEqual(['tutor']);
  });

  it('forbids an admin editing another admin', async () => {
    const repo = makeRepo({
      getUserForAdmin: vi.fn().mockResolvedValue(row('u2', ['admin'])),
      updateUserForAdmin: vi.fn(),
    });
    const manager = new PeopleManager(repo);

    await expect(manager.updateUser(admin, 'u2', edit)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.updateUserForAdmin).not.toHaveBeenCalled();
  });

  it('forbids an admin granting the admin role', async () => {
    const repo = makeRepo({
      getUserForAdmin: vi.fn().mockResolvedValue(row('u1', ['parent'])),
      updateUserForAdmin: vi.fn(),
    });
    const manager = new PeopleManager(repo);

    await expect(
      manager.updateUser(admin, 'u1', { ...edit, roles: ['admin'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s when the user does not exist', async () => {
    const repo = makeRepo({
      getUserForAdmin: vi.fn().mockResolvedValue(undefined),
    });
    const manager = new PeopleManager(repo);

    await expect(manager.updateUser(admin, 'nope', edit)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deactivates a user through the auth admin client', async () => {
    const getUserForAdmin = vi
      .fn()
      .mockResolvedValueOnce(row('u1', ['parent']))
      .mockResolvedValueOnce(row('u1', ['parent'], false));
    const adminAuth = makeAdminAuth();
    const manager = new PeopleManager(
      makeRepo({ getUserForAdmin }),
      adminAuth as unknown as SupabaseAdminAuthService,
    );

    const result = await manager.setUserActive(admin, 'u1', false);

    expect(adminAuth.setUserActive).toHaveBeenCalledWith('u1', false);
    expect(result.isActive).toBe(false);
  });

  it('refuses to let a user deactivate themselves', async () => {
    const adminAuth = makeAdminAuth();
    const manager = new PeopleManager(
      makeRepo(),
      adminAuth as unknown as SupabaseAdminAuthService,
    );

    await expect(
      manager.setUserActive(superadmin, 'superadmin-1', false),
    ).rejects.toBeInstanceOf(BusinessRuleException);
    expect(adminAuth.setUserActive).not.toHaveBeenCalled();
  });

  it('refuses to deactivate a super admin', async () => {
    const adminAuth = makeAdminAuth();
    const manager = new PeopleManager(
      makeRepo({
        getUserForAdmin: vi.fn().mockResolvedValue(row('s2', ['superadmin'])),
      }),
      adminAuth as unknown as SupabaseAdminAuthService,
    );

    await expect(
      manager.setUserActive(superadmin, 's2', false),
    ).rejects.toBeInstanceOf(BusinessRuleException);
  });
});
