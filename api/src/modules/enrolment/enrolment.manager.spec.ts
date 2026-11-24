import { NotFoundException } from '@nestjs/common';
import type { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { UnitOfWork } from '../../database/unit-of-work.js';
import type { SubmitEnrolmentDto } from './dto/submit-enrolment.dto.js';
import { EnrolmentManager } from './enrolment.manager.js';
import type { EnrolmentRepository } from './enrolment.repository.js';

function makeUow(): UnitOfWork {
  return {
    run: vi.fn((fn: () => Promise<unknown>) => fn()),
  } as unknown as UnitOfWork;
}

function makeStorage(move = vi.fn().mockResolvedValue(undefined)) {
  return { move } as unknown as FileStorageService & { move: typeof move };
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

const PARENT: AuthUser = { id: 'u1', roles: ['parent'], claims: { sub: 'u1', role: 'authenticated' } };

const SUBMIT_DTO: SubmitEnrolmentDto = {
  learner: { fullName: 'Alex', dateOfBirth: '2013-04-02', gradeCode: 'grade_7' },
  packageCode: 'group_1',
  emergencyContacts: [{ fullName: 'Jo', relationship: 'aunt', phone: '0820000000' }],
  consents: [{ consentTypeCode: 'popia_processing', granted: true }],
  policyVersion: '1.0',
  reportCard: {
    path: 'staging/aaaaaaaa-0000-0000-0000-000000000001/0b6d7c1e-1f2a-4c3b-9d8e-7a6b5c4d3e2f.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1000,
    originalName: 'report.pdf',
  },
};

describe('EnrolmentManager.submit', () => {
  it('files the report card under the learner inside the same unit of work', async () => {
    const order: string[] = [];
    const repo = {
      submit: vi.fn().mockImplementation(() => {
        order.push('submit');
        return Promise.resolve({
          enrolmentId: 'e1',
          learnerId: 'l1',
          reportCard: { documentId: 'd1', stagingPath: 'staging/u/f.pdf', storagePath: 'learners/l1/d1.pdf' },
        });
      }),
      getById: vi.fn().mockResolvedValue(ENROLMENT_ROW),
    } as unknown as EnrolmentRepository;
    const storage = makeStorage(
      vi.fn().mockImplementation(() => {
        order.push('move');
        return Promise.resolve();
      }),
    );
    const uow = makeUow();
    const manager = new EnrolmentManager(repo, uow, storage);

    const dto = await manager.submit(PARENT, SUBMIT_DTO);

    expect(dto.id).toBe('e1');
    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['submit', 'move']);
    expect(storage.move).toHaveBeenCalledWith('learner-documents', 'staging/u/f.pdf', 'learners/l1/d1.pdf');
  });

  it('fails the whole submission when the file cannot be moved', async () => {
    const repo = {
      submit: vi.fn().mockResolvedValue({
        enrolmentId: 'e1',
        learnerId: 'l1',
        reportCard: { documentId: 'd1', stagingPath: 's', storagePath: 't' },
      }),
      getById: vi.fn(),
    } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(
      repo,
      makeUow(),
      makeStorage(vi.fn().mockRejectedValue(new Error('storage down'))),
    );

    await expect(manager.submit(PARENT, SUBMIT_DTO)).rejects.toThrow('storage down');
    expect(repo.getById).not.toHaveBeenCalled();
  });
});

describe('EnrolmentManager.replaceReportCard', () => {
  it('records the new card then moves its file', async () => {
    const repo = {
      replaceReportCard: vi.fn().mockResolvedValue({ documentId: 'd2', stagingPath: 's', storagePath: 't' }),
    } as unknown as EnrolmentRepository;
    const storage = makeStorage();
    const manager = new EnrolmentManager(repo, makeUow(), storage);

    await expect(manager.replaceReportCard('e1', SUBMIT_DTO.reportCard)).resolves.toEqual({ documentId: 'd2' });
    expect(storage.move).toHaveBeenCalledWith('learner-documents', 's', 't');
  });
});

describe('EnrolmentManager.activate', () => {
  it('passes the optional tutor through and raises nothing itself', async () => {
    const repo = { activate: vi.fn().mockResolvedValue(undefined) } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow(), makeStorage());

    await expect(manager.activate('e1', { assignedTutorId: 't1' })).resolves.toEqual({ enrolmentId: 'e1' });
    expect(repo.activate).toHaveBeenCalledWith('e1', 't1');
  });
});

describe('EnrolmentManager.decline', () => {
  it('declines with the reason and message, then returns the enrolment', async () => {
    const repo = {
      decline: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue({ ...ENROLMENT_ROW, status: 'declined' }),
    } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow(), makeStorage());

    const dto = await manager.decline('e1', { reason: 'No class available', message: 'Sorry' });

    expect(repo.decline).toHaveBeenCalledWith('e1', 'No class available', 'Sorry');
    expect(dto.status).toBe('declined');
  });
});

describe('EnrolmentManager.progress', () => {
  it('maps the derived stage', async () => {
    const repo = {
      getProgress: vi.fn().mockResolvedValue({
        enrolment_id: 'e1', learner_id: 'l1', status: 'accepted', stage: 'payment',
        offer_expires_on: '2026-12-01', offer_invoice_id: 'i1', offer_balance_cents: 30000,
        open_submission_id: null, submission_status: null, decline_reason: null,
      }),
    } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow(), makeStorage());

    await expect(manager.progress('e1')).resolves.toEqual({
      enrolmentId: 'e1',
      learnerId: 'l1',
      status: 'accepted',
      stage: 'payment',
      offerExpiresOn: '2026-12-01',
      offerInvoiceId: 'i1',
      offerBalanceCents: 30000,
      openSubmissionId: undefined,
      submissionStatus: undefined,
      declineReason: undefined,
    });
  });

  it('404s when RLS hides the application', async () => {
    const repo = { getProgress: vi.fn().mockResolvedValue(undefined) } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow(), makeStorage());
    await expect(manager.progress('e1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('EnrolmentManager.updateSubjects', () => {
  it('clears then inserts inside one UnitOfWork, so the deferred allowance trigger sees the final set at one commit', async () => {
    const order: string[] = [];
    const uow = makeUow();
    const repo = {
      clearSubjects: vi.fn().mockImplementation(() => {
        order.push('clear');
        return Promise.resolve();
      }),
      insertSubjects: vi.fn().mockImplementation(() => {
        order.push('insert');
        return Promise.resolve();
      }),
      listSubjects: vi.fn().mockResolvedValue([
        { enrolment_id: 'e1', subject_code: 'mathematics', preferred_language_code: 'english' },
      ]),
    } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, uow, makeStorage());

    const dtos = await manager.updateSubjects('e1', {
      subjects: [{ subjectCode: 'mathematics', preferredLanguageCode: 'english' }],
    });

    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['clear', 'insert']);
    expect(dtos).toEqual([{ subjectCode: 'mathematics', preferredLanguageCode: 'english' }]);
  });
});

describe('EnrolmentManager.getById', () => {
  it('404s when RLS filters the row out (not entitled)', async () => {
    const repo = { getById: vi.fn().mockResolvedValue(undefined) } as unknown as EnrolmentRepository;
    const manager = new EnrolmentManager(repo, makeUow(), makeStorage());
    await expect(manager.getById('e1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
