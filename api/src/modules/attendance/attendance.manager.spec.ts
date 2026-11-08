import { NotFoundException } from '@nestjs/common';
import { AttendanceManager } from './attendance.manager.js';
import type { AttendanceRepository } from './attendance.repository.js';

const ACTOR = { id: 'profile-1', roles: ['tutor'], claims: {} };

describe('AttendanceManager.markAttendance', () => {
  it('passes the actor id as markedBy, never trusting a client-supplied value', async () => {
    const markAttendance = vi.fn().mockResolvedValue({
      id: 'ar-1',
      class_session_id: 'cs-1',
      learner_id: 'l-1',
      status: 'present',
      marked_by: 'profile-1',
      marked_at: new Date(),
      note: '',
    });
    const repo = { markAttendance } as unknown as AttendanceRepository;
    const manager = new AttendanceManager(repo);

    await manager.markAttendance('cs-1', ACTOR, { learnerId: 'l-1', status: 'present' });

    expect(markAttendance).toHaveBeenCalledWith({
      classSessionId: 'cs-1',
      learnerId: 'l-1',
      status: 'present',
      markedBy: 'profile-1',
      note: undefined,
    });
  });
});

describe('AttendanceManager.correctAttendance', () => {
  it('404s when the repository finds no matching record', async () => {
    const repo = {
      correctAttendance: vi.fn().mockResolvedValue(undefined),
    } as unknown as AttendanceRepository;
    const manager = new AttendanceManager(repo);

    await expect(
      manager.correctAttendance('cs-1', 'ar-1', ACTOR, { status: 'late' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AttendanceManager.signOut', () => {
  it('passes the actor id as signedOutBy and the dto collector/note through', async () => {
    const signOutCheckIn = vi.fn().mockResolvedValue({
      id: 'ci-1',
      class_session_id: 'cs-1',
      learner_id: 'l-1',
      arrived_at: new Date(),
      signed_in_by: 'admin-1',
      departed_at: new Date(),
      collected_by: 'collector-1',
      signed_out_by: 'profile-1',
      note: '',
    });
    const repo = { signOutCheckIn } as unknown as AttendanceRepository;
    const manager = new AttendanceManager(repo);

    await manager.signOut('cs-1', 'ci-1', ACTOR, { collectedBy: 'collector-1' });

    expect(signOutCheckIn).toHaveBeenCalledWith('cs-1', 'ci-1', {
      collectedBy: 'collector-1',
      signedOutBy: 'profile-1',
      note: undefined,
    });
  });

  it('404s when the check-in does not exist or belongs to a different session', async () => {
    const repo = {
      signOutCheckIn: vi.fn().mockResolvedValue(undefined),
    } as unknown as AttendanceRepository;
    const manager = new AttendanceManager(repo);

    await expect(
      manager.signOut('cs-1', 'ci-1', ACTOR, { collectedBy: 'collector-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
