import type { StoredProcRunner } from '../../database/stored-proc.runner';
import { AttendanceRepository } from './attendance.repository';

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

describe('AttendanceRepository.markAttendance', () => {
  it('inserts with the marker as marked_by and defaults note to empty', async () => {
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'ar-1' }], rowCount: 1 });
    const repo = new AttendanceRepository(makeSp({ executeRaw }));

    await repo.markAttendance({
      classSessionId: 'cs-1',
      learnerId: 'l-1',
      status: 'present',
      markedBy: 'tutor-profile-1',
    });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("coalesce($5, '')");
    expect(values).toEqual(['cs-1', 'l-1', 'present', 'tutor-profile-1', null]);
  });
});

describe('AttendanceRepository.correctAttendance', () => {
  it('always updates marked_by/marked_at to the corrector, plus any provided fields', async () => {
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'ar-1' }], rowCount: 1 });
    const repo = new AttendanceRepository(makeSp({ executeRaw }));

    await repo.correctAttendance('cs-1', 'ar-1', 'admin-1', { status: 'late' });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('marked_by = $1');
    expect(sql).toContain('marked_at = now()');
    expect(sql).toContain('status = $2');
    expect(sql).toContain('where id = $3 and class_session_id = $4');
    expect(values).toEqual(['admin-1', 'late', 'ar-1', 'cs-1']);
  });

  it('returns undefined when nothing matched (e.g. the record belongs to a different session)', async () => {
    const executeRaw = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repo = new AttendanceRepository(makeSp({ executeRaw }));

    const row = await repo.correctAttendance('cs-wrong', 'ar-1', 'admin-1', { note: 'oops' });

    expect(row).toBeUndefined();
  });
});

describe('AttendanceRepository.signOutCheckIn', () => {
  it('sets departed_at via now() (no column default applies on UPDATE) and triggers the collector check', async () => {
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'ci-1' }], rowCount: 1 });
    const repo = new AttendanceRepository(makeSp({ executeRaw }));

    await repo.signOutCheckIn('cs-1', 'ci-1', {
      collectedBy: 'collector-1',
      signedOutBy: 'admin-1',
    });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('departed_at = now()');
    expect(sql).toContain('collected_by = $1');
    expect(sql).toContain('signed_out_by = $2');
    expect(values).toEqual(['collector-1', 'admin-1', 'ci-1', 'cs-1']);
  });

  it('includes note only when given', async () => {
    const executeRaw = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'ci-1' }], rowCount: 1 });
    const repo = new AttendanceRepository(makeSp({ executeRaw }));

    await repo.signOutCheckIn('cs-1', 'ci-1', {
      collectedBy: 'collector-1',
      signedOutBy: 'admin-1',
      note: 'Collected by aunt',
    });

    const [sql, values] = executeRaw.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('note = $3');
    expect(values).toEqual(['collector-1', 'admin-1', 'Collected by aunt', 'ci-1', 'cs-1']);
  });
});
