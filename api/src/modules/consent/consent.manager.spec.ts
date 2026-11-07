import { NotFoundException } from '@nestjs/common';
import { ConsentManager } from './consent.manager';
import type { ConsentRepository } from './consent.repository';

const CONSENT_ROW = {
  id: 'c1',
  consent_type_code: 'enrolment_s35',
  guardian_id: 'guardian-1',
  learner_id: 'learner-1',
  granted: true,
  granted_at: new Date('2026-01-01T00:00:00Z'),
  withdrawn_at: null,
  policy_version: 'v1',
};

describe('ConsentManager.list', () => {
  it('404s when the actor is not entitled (not a guardian-of, not admin) instead of returning an ambiguous empty list', async () => {
    const listForLearner = vi.fn();
    const repo = {
      isEntitledToLearner: vi.fn().mockResolvedValue(false),
      listForLearner,
    } as unknown as ConsentRepository;
    const manager = new ConsentManager(repo);

    await expect(manager.list('learner-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(listForLearner).not.toHaveBeenCalled();
  });

  it('returns the mapped list when entitled, even if empty', async () => {
    const repo = {
      isEntitledToLearner: vi.fn().mockResolvedValue(true),
      listForLearner: vi.fn().mockResolvedValue([CONSENT_ROW]),
    } as unknown as ConsentRepository;
    const manager = new ConsentManager(repo);

    const dtos = await manager.list('learner-1');

    expect(dtos).toHaveLength(1);
    expect(dtos[0]?.consentTypeCode).toBe('enrolment_s35');
  });
});

describe('ConsentManager.withdraw', () => {
  it('404s when no live consent of that type, granted by this guardian, exists', async () => {
    const repo = {
      withdraw: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConsentRepository;
    const manager = new ConsentManager(repo);

    await expect(
      manager.withdraw('learner-1', 'enrolment_s35', { id: 'guardian-2', roles: ['parent'], claims: {} }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scopes the withdraw to the actor\'s own id, never a client-supplied guardian id', async () => {
    const withdraw = vi.fn().mockResolvedValue({ ...CONSENT_ROW, withdrawn_at: new Date() });
    const repo = { withdraw } as unknown as ConsentRepository;
    const manager = new ConsentManager(repo);

    await manager.withdraw('learner-1', 'enrolment_s35', {
      id: 'guardian-1',
      roles: ['parent'],
      claims: {},
    });

    expect(withdraw).toHaveBeenCalledWith('learner-1', 'enrolment_s35', 'guardian-1');
  });
});

describe('ConsentManager.recordAction', () => {
  it('passes the actor as confirmedBy, never trusting a client-supplied value', async () => {
    const recordLearnerRetentionAction = vi.fn().mockResolvedValue({
      id: 'log-1',
      record_class: 'learner_records',
      subject_id: 'learner-1',
      subject_label: 'Jane Doe',
      action: 'anonymised',
      performed_at: new Date(),
      confirmed_by: 'admin-1',
      note: '',
    });
    const repo = { recordLearnerRetentionAction } as unknown as ConsentRepository;
    const manager = new ConsentManager(repo);

    await manager.recordAction('learner-1', { id: 'admin-1', roles: ['admin'], claims: {} }, {
      action: 'anonymised',
    });

    expect(recordLearnerRetentionAction).toHaveBeenCalledWith({
      learnerId: 'learner-1',
      action: 'anonymised',
      confirmedBy: 'admin-1',
      note: undefined,
    });
  });
});
