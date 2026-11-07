import { NotFoundException } from '@nestjs/common';
import { ProgressReportManager } from './progress-report.manager';
import type { ProgressReportRepository } from './progress-report.repository';

const ACTOR = { id: 'guardian-1', roles: ['parent'], claims: {} };

const REPORT_ROW = {
  id: 'r-1',
  learner_id: 'l-1',
  term_id: 't-1',
  tutor_id: 'tutor-1',
  summary: '',
  attendance_note: '',
  issued_on: null,
  published_at: null,
  created_by: 'tutor-profile-1',
  created_at: new Date(),
  subjects: [],
  acknowledgements: [],
};

describe('ProgressReportManager.getById', () => {
  it('404s when the repository finds no matching report — including when RLS hides a draft from a non-teaching guardian', async () => {
    const repo = {
      getById: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProgressReportRepository;
    const manager = new ProgressReportManager(repo);

    await expect(manager.getById('r-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the mapped report when found', async () => {
    const repo = {
      getById: vi.fn().mockResolvedValue(REPORT_ROW),
    } as unknown as ProgressReportRepository;
    const manager = new ProgressReportManager(repo);

    const dto = await manager.getById('r-1');

    expect(dto.id).toBe('r-1');
  });
});

describe('ProgressReportManager.save', () => {
  it('defaults publish to false and reads back the saved row for the response', async () => {
    const save = vi.fn().mockResolvedValue('r-1');
    const getById = vi.fn().mockResolvedValue(REPORT_ROW);
    const repo = { save, getById } as unknown as ProgressReportRepository;
    const manager = new ProgressReportManager(repo);

    await manager.save('l-1', 't-1', {
      subjects: [{ subjectCode: 'mathematics' }],
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ learnerId: 'l-1', termId: 't-1', publish: false }),
    );
    expect(getById).toHaveBeenCalledWith('r-1');
  });
});

describe('ProgressReportManager.acknowledge', () => {
  it('passes the actor id as the guardian, never a client-supplied value', async () => {
    const acknowledge = vi.fn().mockResolvedValue({
      guardian_id: 'guardian-1',
      acknowledged_at: new Date(),
      comment: '',
    });
    const getById = vi.fn().mockResolvedValue(REPORT_ROW);
    const repo = { acknowledge, getById } as unknown as ProgressReportRepository;
    const manager = new ProgressReportManager(repo);

    await manager.acknowledge('r-1', ACTOR, { comment: 'Thank you' });

    expect(acknowledge).toHaveBeenCalledWith('r-1', 'guardian-1', 'Thank you');
  });
});
