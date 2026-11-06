import { NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { PeopleManager } from './people.manager';
import type { PeopleRepository } from './people.repository';

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
