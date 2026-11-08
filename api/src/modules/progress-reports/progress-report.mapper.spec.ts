import { ProgressReportMapper } from './progress-report.mapper.js';
import type { SaveProgressReportDto } from './dto/progress-report.dto.js';
import type { ProgressReportRow } from './rows/progress-report.row.js';

describe('ProgressReportMapper.toSubjectsPayload', () => {
  it('maps every subject field to its snake_case jsonb key, defaulting omitted text fields to empty strings', () => {
    const dto: SaveProgressReportDto = {
      publish: true,
      subjects: [
        {
          subjectCode: 'mathematics',
          achievementLevelCode: 5,
          strengths: 'Strong mental maths',
          areasForImprovement: 'Long division',
          recommendedIntervention: 'Extra worksheets',
        },
        { subjectCode: 'english' },
      ],
    };

    const payload = ProgressReportMapper.toSubjectsPayload(dto);

    expect(payload).toEqual([
      {
        subject_code: 'mathematics',
        achievement_level_code: 5,
        strengths: 'Strong mental maths',
        areas_for_improvement: 'Long division',
        recommended_intervention: 'Extra worksheets',
      },
      {
        subject_code: 'english',
        achievement_level_code: undefined,
        strengths: '',
        areas_for_improvement: '',
        recommended_intervention: '',
      },
    ]);
  });
});

describe('ProgressReportMapper.toDto', () => {
  it('maps a report with its subjects and acknowledgements, leaving publishedAt undefined for a draft', () => {
    const row: ProgressReportRow = {
      id: 'r-1',
      learner_id: 'l-1',
      term_id: 't-1',
      tutor_id: 'tutor-1',
      summary: 'Good progress this term',
      attendance_note: '',
      issued_on: null,
      published_at: null,
      created_by: 'profile-1',
      created_at: new Date('2026-11-07T10:00:00Z'),
      subjects: [
        {
          id: 'rs-1',
          subject_code: 'mathematics',
          achievement_level_code: 5,
          strengths: 'Strong mental maths',
          areas_for_improvement: '',
          recommended_intervention: '',
        },
      ],
      acknowledgements: [],
    };

    const dto = ProgressReportMapper.toDto(row);

    expect(dto.publishedAt).toBeUndefined();
    expect(dto.subjects).toEqual([
      {
        subjectCode: 'mathematics',
        achievementLevelCode: 5,
        strengths: 'Strong mental maths',
        areasForImprovement: '',
        recommendedIntervention: '',
      },
    ]);
    expect(dto.acknowledgements).toEqual([]);
  });

  it('converts publishedAt and each acknowledgement’s acknowledgedAt to ISO strings once published', () => {
    const row: ProgressReportRow = {
      id: 'r-1',
      learner_id: 'l-1',
      term_id: 't-1',
      tutor_id: 'tutor-1',
      summary: '',
      attendance_note: '',
      issued_on: '2026-11-07',
      published_at: new Date('2026-11-07T10:00:00Z'),
      created_by: 'profile-1',
      created_at: new Date('2026-11-07T09:00:00Z'),
      subjects: [],
      acknowledgements: [
        { guardian_id: 'guardian-1', acknowledged_at: '2026-11-08T08:00:00+00:00', comment: 'Thank you' },
      ],
    };

    const dto = ProgressReportMapper.toDto(row);

    expect(dto.publishedAt).toBe('2026-11-07T10:00:00.000Z');
    expect(dto.acknowledgements).toEqual([
      { guardianId: 'guardian-1', acknowledgedAt: '2026-11-08T08:00:00+00:00', comment: 'Thank you' },
    ]);
  });
});
