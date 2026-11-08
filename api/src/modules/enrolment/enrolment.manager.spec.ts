import { NotFoundException } from '@nestjs/common';
import type { UnitOfWork } from '../../database/unit-of-work.js';
import { EnrolmentManager } from './enrolment.manager.js';
import type { EnrolmentRepository } from './enrolment.repository.js';

function makeUow(): UnitOfWork {
  return {
    run: vi.fn((fn: () => Promise<unknown>) => fn()),
  } as unknown as UnitOfWork;
}

const ENROLMENT_ROW = {
  id: 'e1',
  learner_id: 'l1',
  package_code: 'group_1',
  status: 'pending',
  preferred_tutor_id: null,
  assigned_tutor_id: null,
  start_date: null,
  end_date: null,
  first_month_amount_cents: null,
  first_month_reason: null,
  source: 'website',
  created_at: new Date(),
  activated_at: null,
};

describe('EnrolmentManager.activate', () => {
  it('surfaces registrationInvoiceId as undefined (not null, not a fabricated id) when the learner was already registered', async () => {
    const repo = {
      activate: vi.fn().mockResolvedValue(null),
    } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow());

    const result = await manager.activate('e1', { assignedTutorId: 't1' });

    expect(result).toEqual({
      enrolmentId: 'e1',
      registrationInvoiceId: undefined,
    });
  });

  it('surfaces the real invoice id when one was created', async () => {
    const repo = {
      activate: vi.fn().mockResolvedValue('invoice-1'),
    } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow());

    const result = await manager.activate('e1', { assignedTutorId: 't1' });

    expect(result).toEqual({
      enrolmentId: 'e1',
      registrationInvoiceId: 'invoice-1',
    });
  });

  it('passes every optional field through to the repository unchanged', async () => {
    const activate = vi.fn().mockResolvedValue(null);
    const repo = { activate } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow());

    await manager.activate('e1', {
      assignedTutorId: 't1',
      startDate: '2026-01-12',
      firstMonthCents: 20000,
      reason: 'late',
    });

    expect(activate).toHaveBeenCalledWith({
      enrolmentId: 'e1',
      assignedTutorId: 't1',
      startDate: '2026-01-12',
      firstMonthCents: 20000,
      reason: 'late',
    });
  });
});

describe('EnrolmentManager.decline', () => {
  it('404s when the enrolment does not exist or is not pending', async () => {
    const repo = {
      decline: vi.fn().mockResolvedValue(undefined),
    } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow());

    await expect(manager.decline('e1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the mapped enrolment on success', async () => {
    const repo = {
      decline: vi
        .fn()
        .mockResolvedValue({ ...ENROLMENT_ROW, status: 'declined' }),
    } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow());

    const dto = await manager.decline('e1');

    expect(dto.status).toBe('declined');
  });
});

describe('EnrolmentManager.updateSubjects', () => {
  it('clears then inserts inside one UnitOfWork, so the deferred allowance trigger sees the final set at one commit', async () => {
    const order: string[] = [];
    const uow = {
      run: vi.fn((fn: () => Promise<unknown>) => fn()),
    } as unknown as UnitOfWork;
    const repo = {
      clearSubjects: vi.fn().mockImplementation(() => {
        order.push('clear');
        return Promise.resolve();
      }),
      insertSubjects: vi.fn().mockImplementation(() => {
        order.push('insert');
        return Promise.resolve();
      }),
      listSubjects: vi
        .fn()
        .mockResolvedValue([
          {
            enrolment_id: 'e1',
            subject_code: 'mathematics',
            preferred_language_code: 'english',
          },
        ]),
    } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, uow);

    const dtos = await manager.updateSubjects('e1', {
      subjects: [
        { subjectCode: 'mathematics', preferredLanguageCode: 'english' },
      ],
    });

    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['clear', 'insert']);
    expect(dtos).toEqual([
      { subjectCode: 'mathematics', preferredLanguageCode: 'english' },
    ]);
  });
});

describe('EnrolmentManager.getById', () => {
  it('404s when RLS filters the row out (not entitled)', async () => {
    const repo = {
      getById: vi.fn().mockResolvedValue(undefined),
    } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow());

    await expect(manager.getById('e1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
