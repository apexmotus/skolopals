import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import { EnrolmentRepository } from './enrolment.repository.js';

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
  it('calls private.submit_enrolment with every jsonb param named correctly', async () => {
    const result = { enrolmentId: 'e1', learnerId: 'l1', reportCard: { documentId: 'd1', stagingPath: 's', storagePath: 't' } };
    const queryOne = vi.fn().mockResolvedValue({ submit_enrolment: result });
    const repo = new EnrolmentRepository(makeSp({ queryOne }));

    await expect(
      repo.submit({
        learner: { full_name: 'Alex' },
        packageCode: 'group_1',
        subjects: [],
        emergencyContacts: [{ full_name: 'Guardian' }],
        collectors: [],
        consents: [{ consent_type_code: 'popia_processing', granted: true }],
        policyVersion: '1.0',
        reportCard: { stagingPath: 's' },
      }),
    ).resolves.toEqual(result);

    expect(queryOne.mock.calls[0]?.[0]).toBe('private.submit_enrolment');
    const params = queryOne.mock.calls[0]?.[1] as { name: string; value: unknown }[];
    expect(params.map((param) => param.name)).toEqual([
      'p_learner',
      'p_package_code',
      'p_subjects',
      'p_emergency',
      'p_collectors',
      'p_consents',
      'p_policy_version',
      'p_report_card',
      'p_preferred_tutor',
    ]);
    // jsonb params must be JSON-encoded strings, never raw JS objects.
    expect(params[0]?.value).toBe(JSON.stringify({ full_name: 'Alex' }));
    expect(params[7]?.value).toBe(JSON.stringify({ stagingPath: 's' }));
    expect(params[8]?.value).toBeNull();
  });
});

describe('EnrolmentRepository decisions', () => {
  it('accept calls public.accept_enrolment and unwraps its jsonb', async () => {
    const queryOne = vi.fn().mockResolvedValue({
      accept_enrolment: { invoiceId: 'i1', amountDueCents: 30000, offerExpiresOn: '2026-12-01' },
    });
    const repo = new EnrolmentRepository(makeSp({ queryOne }));
    await expect(repo.accept('e1')).resolves.toEqual({ invoiceId: 'i1', amountDueCents: 30000, offerExpiresOn: '2026-12-01' });
    expect(queryOne).toHaveBeenCalledWith('public.accept_enrolment', [{ name: 'p_enrolment_id', value: 'e1' }]);
  });

  it('decline sends the reason and a null message when none is given', async () => {
    const queryOne = vi.fn().mockResolvedValue({});
    const repo = new EnrolmentRepository(makeSp({ queryOne }));
    await repo.decline('e1', 'No class available');
    expect(queryOne).toHaveBeenCalledWith('public.decline_enrolment', [
      { name: 'p_enrolment_id', value: 'e1' },
      { name: 'p_reason', value: 'No class available' },
      { name: 'p_message', value: null },
    ]);
  });

  it('activate passes a null tutor so automatic placement keeps its choice', async () => {
    const queryOne = vi.fn().mockResolvedValue({});
    const repo = new EnrolmentRepository(makeSp({ queryOne }));
    await repo.activate('e1');
    expect(queryOne).toHaveBeenCalledWith('public.activate_enrolment', [
      { name: 'p_enrolment_id', value: 'e1' },
      { name: 'p_assigned_tutor_id', value: null },
    ]);
  });

  it('quote omits the optional date and learner so the SQL defaults apply', async () => {
    const queryOne = vi.fn().mockResolvedValue({ enrolment_quote: { totalCents: 30000 } });
    const repo = new EnrolmentRepository(makeSp({ queryOne }));
    await repo.quote('group_1');
    expect(queryOne).toHaveBeenCalledWith('public.enrolment_quote', [{ name: 'p_package_code', value: 'group_1' }]);
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
