import { describe, expect, it, vi } from 'vitest';
import type { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { UnitOfWork } from '../../database/unit-of-work.js';
import type { SubmitTutorApplicationDto } from './dto/tutor-application.dto.js';
import {
  normaliseSaPhone,
  normaliseWhatsApp,
  summariseSubjects,
  TutorApplicationsManager,
} from './tutor-applications.manager.js';
import { TutorApplicationsRepository } from './tutor-applications.repository.js';

const U = '11111111-1111-4111-8111-111111111111';
const staged = (n: number, ext = 'pdf') => `staging/${U}/00000000-0000-4000-8000-00000000000${n}.${ext}`;

function makeUow(): UnitOfWork {
  return { run: vi.fn((fn: () => Promise<unknown>) => fn()) } as unknown as UnitOfWork;
}

function application(overrides: Partial<SubmitTutorApplicationDto> = {}): SubmitTutorApplicationDto {
  return {
    firstName: ' Zanele ',
    lastName: 'Mthembu',
    phone: '072 123 4567',
    address: { line1: '12 Mampe St', city: 'Brits', province: 'North West' },
    competencies: [{ subjectCode: 'mathematics', gradeCodes: ['grade_6', 'grade_7', 'grade_7'], languageCodes: ['english'] }],
    documents: [
      { docType: 'cv', path: staged(1), mimeType: 'application/pdf', sizeBytes: 10 },
      { docType: 'qualification', path: staged(2), mimeType: 'application/pdf', sizeBytes: 10, title: 'BEd' },
      { docType: 'id', path: staged(3, 'jpg'), mimeType: 'image/jpeg', sizeBytes: 10 },
      { docType: 'selfie', path: staged(4, 'jpg'), mimeType: 'image/jpeg', sizeBytes: 10 },
    ],
    references: [
      { fullName: 'A', relationship: 'Principal', phone: '0820000001' },
      { fullName: 'B', relationship: 'HOD', phone: '0820000002' },
      { fullName: 'C', relationship: 'Colleague', phone: '0820000003' },
    ],
    consents: { popia: true, referencesAgreed: true, declaration: true },
    ...overrides,
  };
}

describe('phone numbers', () => {
  it.each([
    ['072 123 4567', '+27721234567'],
    ['0721234567', '+27721234567'],
    ['27721234567', '+27721234567'],
    ['+27 72 123 4567', '+27721234567'],
    ['(012) 345-6789', '+27123456789'],
  ])('normalises %s', (raw, expected) => {
    expect(normaliseSaPhone(raw)).toBe(expected);
  });

  it.each(['12345', '0021234567', '+44 7700 900123', ''])('refuses %s as a South African number', (raw) => {
    expect(normaliseSaPhone(raw)).toBeNull();
  });

  it('accepts a foreign WhatsApp number in international form', () => {
    expect(normaliseWhatsApp('+44 7700 900123')).toBe('+447700900123');
    expect(normaliseWhatsApp('7700 900123')).toBeNull();
  });
});

describe('summariseSubjects', () => {
  it('collapses consecutive grades into ranges', () => {
    expect(
      summariseSubjects([
        { subject: 'Mathematics', grades: [4, 5, 6, 7].map((n) => ({ name: `Grade ${n}`, order: n })) },
        {
          subject: 'English',
          grades: [
            { name: 'Grade R', order: 0 },
            { name: 'Grade 2', order: 2 },
            { name: 'Grade 3', order: 3 },
          ],
        },
      ]),
    ).toBe('Mathematics 4–7 · English R, 2–3');
  });
});

describe('TutorApplicationsRepository', () => {
  it('keeps every function that takes a storage path in the private schema', async () => {
    const queryOne = vi.fn().mockResolvedValue({ x: {} });
    const repo = new TutorApplicationsRepository({ queryOne } as unknown as StoredProcRunner);
    await repo.submit({}).catch(() => undefined);
    await repo.withdraw('a1');
    await repo.addPoliceClearance({}).catch(() => undefined);
    for (const [fn] of queryOne.mock.calls) expect(fn).toMatch(/^private\./);
  });

  it('passes exactly one target when requesting a police clearance', async () => {
    const queryOne = vi.fn().mockResolvedValue({});
    const repo = new TutorApplicationsRepository({ queryOne } as unknown as StoredProcRunner);
    await repo.requestPoliceClearance({ tutorId: 't1' }, null);
    expect(queryOne).toHaveBeenCalledWith('public.request_police_clearance', [
      { name: 'p_application_id', value: null },
      { name: 'p_tutor_id', value: 't1' },
      { name: 'p_note', value: '' },
    ]);
  });
});

describe('TutorApplicationsManager.submit', () => {
  function setup() {
    const order: string[] = [];
    const submit = vi.fn().mockImplementation(() => {
      order.push('submit');
      return Promise.resolve({
        applicationId: 'app-1',
        documents: [
          { stagingPath: staged(1), storagePath: 'applications/app-1/a.pdf' },
          { stagingPath: staged(4, 'jpg'), storagePath: 'applications/app-1/b.jpg' },
        ],
      });
    });
    const move = vi.fn().mockImplementation(() => {
      order.push('move');
      return Promise.resolve();
    });
    const uow = makeUow();
    const manager = new TutorApplicationsManager(
      { submit } as unknown as TutorApplicationsRepository,
      uow,
      { move } as unknown as FileStorageService,
    );
    return { manager, submit, move, uow, order };
  }

  it('records the application, then files every document, in one unit of work', async () => {
    const { manager, move, uow, order } = setup();
    await expect(manager.submit(application())).resolves.toEqual({ applicationId: 'app-1' });
    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['submit', 'move', 'move']);
    expect(move).toHaveBeenCalledWith('tutor-documents', staged(4, 'jpg'), 'applications/app-1/b.jpg');
  });

  it('normalises phones, copies the phone to WhatsApp, and sends one competency per grade', async () => {
    const { manager, submit } = setup();
    await manager.submit(application());
    const payload = submit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      firstName: 'Zanele',
      phone: '+27721234567',
      whatsappNumber: '+27721234567',
      address: { country: 'South Africa', line2: '' },
      competencies: [
        { subjectCode: 'mathematics', gradeCode: 'grade_6', languageCodes: ['english'] },
        { subjectCode: 'mathematics', gradeCode: 'grade_7', languageCodes: ['english'] },
      ],
    });
  });

  it('keeps a separate WhatsApp number', async () => {
    const { manager, submit } = setup();
    await manager.submit(application({ whatsappNumber: '+44 7700 900123' }));
    expect((submit.mock.calls[0]?.[0] as { whatsappNumber: string }).whatsappNumber).toBe('+447700900123');
  });

  it('refuses a phone number it cannot read, before touching the database', async () => {
    const { manager, submit } = setup();
    await expect(manager.submit(application({ phone: '12345' }))).rejects.toMatchObject({ code: 'INVALID_PHONE' });
    expect(submit).not.toHaveBeenCalled();
  });

  it('refuses two references with the same phone number', async () => {
    const { manager, submit } = setup();
    const refs = application().references.map((r) => ({ fullName: r.fullName, relationship: r.relationship, phone: r.phone }));
    refs[2] = { fullName: 'C', relationship: 'Colleague', phone: '082 000 0001' };
    await expect(manager.submit(application({ references: refs }))).rejects.toMatchObject({
      code: 'DUPLICATE_REFERENCE',
    });
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('TutorApplicationsManager.detail', () => {
  it('signs a short-lived link for each document', async () => {
    const row = {
      id: 'app-1', round_id: 'r1', applicant_id: U, first_name: 'Zanele', last_name: 'Mthembu', email: 'z@test',
      phone: '+27721234567', whatsapp_number: '+27721234567', address_line_1: '12 Mampe St', address_line_2: '',
      city: 'Brits', province: 'North West', country: 'South Africa', status: 'submitted', decision_note: '',
      submitted_at: new Date('2026-11-27T08:00:00Z'), reviewed_at: null, police_clearance_required: false,
      police_clearance_requested_at: null, police_clearance_request_note: '', has_police_clearance: false,
      identity_checked_at: null, tutor_id: null,
      subjects: [{ subject: 'Mathematics', grades: [{ name: 'Grade 7', order: 7 }] }],
    };
    const repo = {
      list: vi.fn().mockResolvedValue([row]),
      listCompetencies: vi.fn().mockResolvedValue([]),
      listDocuments: vi.fn().mockResolvedValue([
        { id: 'd1', doc_type: 'selfie', storage_path: 'applications/app-1/s.jpg', original_name: '', mime_type: 'image/jpeg',
          size_bytes: 10, title: '', institution: '', year_awarded: null, uploaded_at: new Date('2026-11-27T08:00:00Z') },
      ]),
      listReferences: vi.fn().mockResolvedValue([]),
    } as unknown as TutorApplicationsRepository;
    const createDownloadUrl = vi.fn().mockResolvedValue('https://signed');
    const manager = new TutorApplicationsManager(repo, makeUow(), { createDownloadUrl } as unknown as FileStorageService);

    const detail = await manager.detail('app-1');
    expect(createDownloadUrl).toHaveBeenCalledWith('tutor-documents', 'applications/app-1/s.jpg', 300);
    expect(detail.documents[0]?.url).toBe('https://signed');
    expect(detail.subjectsSummary).toBe('Mathematics 7');
  });

  it('is a 404 for an application that does not exist', async () => {
    const repo = { list: vi.fn().mockResolvedValue([]) } as unknown as TutorApplicationsRepository;
    const manager = new TutorApplicationsManager(repo, makeUow(), {} as FileStorageService);
    await expect(manager.detail('nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('TutorApplicationsManager.purge', () => {
  it('deletes the rows, then the files, in one unit of work', async () => {
    const order: string[] = [];
    const repo = {
      purge: vi.fn().mockImplementation(() => {
        order.push('purge');
        return Promise.resolve({ storagePaths: ['applications/a/1.jpg', 'applications/a/2.pdf'] });
      }),
    } as unknown as TutorApplicationsRepository;
    const remove = vi.fn().mockImplementation(() => {
      order.push('remove');
      return Promise.resolve();
    });
    const uow = makeUow();
    const manager = new TutorApplicationsManager(repo, uow, { remove } as unknown as FileStorageService);

    await expect(manager.purge('a')).resolves.toEqual({ deletedFiles: 2 });
    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['purge', 'remove']);
    expect(remove).toHaveBeenCalledWith('tutor-documents', ['applications/a/1.jpg', 'applications/a/2.pdf']);
  });

  it('lets a failed file removal fail the unit of work, so the rows come back', async () => {
    const repo = {
      purge: vi.fn().mockResolvedValue({ storagePaths: ['applications/a/1.jpg'] }),
    } as unknown as TutorApplicationsRepository;
    const remove = vi.fn().mockRejectedValue(new Error('storage down'));
    const manager = new TutorApplicationsManager(repo, makeUow(), { remove } as unknown as FileStorageService);
    await expect(manager.purge('a')).rejects.toThrow('storage down');
  });
});
