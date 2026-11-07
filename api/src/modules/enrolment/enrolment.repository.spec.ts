import type { StoredProcRunner } from '../../database/stored-proc.runner';
import { EnrolmentRepository } from './enrolment.repository';

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

describe('EnrolmentRepository.submit', () => {
  it('calls public.submit_enrolment with every jsonb param named correctly', async () => {
    const queryOne = vi
      .fn()
      .mockResolvedValue({ submit_enrolment: 'enrolment-1' });
    const repo = new EnrolmentRepository(makeSp({ queryOne }));

    const id = await repo.submit({
      learner: { full_name: 'Alex' },
      packageCode: 'group_1',
      subjects: [],
      emergencyContacts: [{ full_name: 'Guardian' }],
      collectors: [],
      consents: [{ consent_type_code: 'popia_processing', granted: true }],
      policyVersion: '1.0',
    });

    expect(id).toBe('enrolment-1');
    const params = queryOne.mock.calls[0]?.[1] as {
      name: string;
      value: unknown;
    }[];
    expect(params.map((param) => param.name)).toEqual([
      'p_learner',
      'p_package_code',
      'p_subjects',
      'p_emergency',
      'p_collectors',
      'p_consents',
      'p_policy_version',
      'p_preferred_tutor',
    ]);
    // jsonb params must be JSON-encoded strings, never raw JS objects.
    expect(params[0]?.value).toBe(JSON.stringify({ full_name: 'Alex' }));
    expect(params[6]?.value).toBe('1.0');
    expect(params[7]?.value).toBeNull();
  });
});

describe('EnrolmentRepository.activate', () => {
  it('omits optional params entirely when not given, so the SQL defaults apply', async () => {
    const queryOne = vi.fn().mockResolvedValue({ activate_enrolment: null });
    const repo = new EnrolmentRepository(makeSp({ queryOne }));

    await repo.activate({ enrolmentId: 'e1', assignedTutorId: 't1' });

    const params = queryOne.mock.calls[0]?.[1] as { name: string }[];
    expect(params.map((param) => param.name)).toEqual([
      'p_enrolment_id',
      'p_assigned_tutor_id',
    ]);
  });

  it('includes every optional param when given', async () => {
    const queryOne = vi
      .fn()
      .mockResolvedValue({ activate_enrolment: 'invoice-1' });
    const repo = new EnrolmentRepository(makeSp({ queryOne }));

    const invoiceId = await repo.activate({
      enrolmentId: 'e1',
      assignedTutorId: 't1',
      startDate: '2026-01-12',
      firstMonthCents: 20000,
      reason: 'late sign-up',
    });

    expect(invoiceId).toBe('invoice-1');
    const params = queryOne.mock.calls[0]?.[1] as { name: string }[];
    expect(params.map((param) => param.name)).toEqual([
      'p_enrolment_id',
      'p_assigned_tutor_id',
      'p_start_date',
      'p_first_month_cents',
      'p_reason',
    ]);
  });

  it('returns null, not a fabricated id, when the function returns no invoice (already registered)', async () => {
    const queryOne = vi.fn().mockResolvedValue({ activate_enrolment: null });
    const repo = new EnrolmentRepository(makeSp({ queryOne }));

    await expect(
      repo.activate({ enrolmentId: 'e1', assignedTutorId: 't1' }),
    ).resolves.toBeNull();
  });
});

describe('EnrolmentRepository.decline', () => {
  it('only updates a pending enrolment', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new EnrolmentRepository(makeSp({ executeRaw }));

    await repo.decline('e1');

    expect(executeRaw).toHaveBeenCalledWith(
      expect.stringContaining("status = 'pending'"),
      ['e1'],
    );
  });
});

describe('EnrolmentRepository.list', () => {
  it('omits the WHERE clause when no status filter is given', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new EnrolmentRepository(makeSp({ executeRaw }));

    await repo.list({ page: 1, pageSize: 20 });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('where');
    expect(values).toEqual([20, 0]);
  });

  it('filters by status when given', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new EnrolmentRepository(makeSp({ executeRaw }));

    await repo.list({ page: 1, pageSize: 20, status: 'pending' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('status = $1');
    expect(values).toEqual(['pending', 20, 0]);
  });
});
