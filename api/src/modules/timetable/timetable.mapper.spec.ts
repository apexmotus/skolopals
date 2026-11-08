import { TimetableMapper } from './timetable.mapper.js';

describe('TimetableMapper.publicEntryToDto', () => {
  it('maps every column straight through', () => {
    const dto = TimetableMapper.publicEntryToDto({
      class_group_id: 'cg1',
      class_name: 'Grade 8 Maths',
      subject: 'Mathematics',
      language: 'English',
      delivery_mode: 'in_centre',
      capacity: 10,
      day_of_week: 2,
      starts_at_time: '14:00',
      ends_at_time: '15:00',
      tutor_slug: 'maya-thompson',
      tutor_name: 'Maya Thompson',
    });

    expect(dto).toEqual({
      classGroupId: 'cg1',
      className: 'Grade 8 Maths',
      subject: 'Mathematics',
      language: 'English',
      deliveryMode: 'in_centre',
      capacity: 10,
      dayOfWeek: 2,
      startsAtTime: '14:00',
      endsAtTime: '15:00',
      tutorSlug: 'maya-thompson',
      tutorName: 'Maya Thompson',
    });
  });
});

describe('TimetableMapper.classGroupToDto', () => {
  it('keeps a null room_id as undefined', () => {
    const dto = TimetableMapper.classGroupToDto(
      {
        id: 'cg1',
        name: 'Grade 8 Maths',
        subject_code: 'maths',
        language_code: 'english',
        tutor_id: 't1',
        term_id: 'term1',
        delivery_mode: 'online',
        room_id: null,
        capacity: 10,
        is_active: true,
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
      ['grade_8'],
    );

    expect(dto.roomId).toBeUndefined();
    expect(dto.gradeCodes).toEqual(['grade_8']);
  });

  it('passes through a real room_id', () => {
    const dto = TimetableMapper.classGroupToDto(
      {
        id: 'cg1',
        name: 'Grade 8 Maths',
        subject_code: 'maths',
        language_code: 'english',
        tutor_id: 't1',
        term_id: 'term1',
        delivery_mode: 'in_centre',
        room_id: 'room-1',
        capacity: 10,
        is_active: true,
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
      [],
    );

    expect(dto.roomId).toBe('room-1');
  });
});

describe('TimetableMapper.scheduleToDto', () => {
  it('maps every column straight through', () => {
    const dto = TimetableMapper.scheduleToDto({
      id: 's1',
      class_group_id: 'cg1',
      day_of_week: 2,
      starts_at_time: '14:00',
      ends_at_time: '15:00',
    });

    expect(dto).toEqual({
      id: 's1',
      classGroupId: 'cg1',
      dayOfWeek: 2,
      startsAtTime: '14:00',
      endsAtTime: '15:00',
    });
  });
});

describe('TimetableMapper.sessionToDto', () => {
  it('keeps every nullable field as undefined when the row has it null', () => {
    const dto = TimetableMapper.sessionToDto({
      id: 'cs1',
      class_group_id: 'cg1',
      schedule_id: null,
      session_date: '2026-11-10',
      starts_at: new Date('2026-11-10T12:00:00Z'),
      ends_at: new Date('2026-11-10T13:00:00Z'),
      status: 'scheduled',
      tutor_id: null,
      meeting_url: null,
      notes: '',
      created_at: new Date('2026-01-01T00:00:00Z'),
    });

    expect(dto.scheduleId).toBeUndefined();
    expect(dto.tutorId).toBeUndefined();
    expect(dto.meetingUrl).toBeUndefined();
  });

  it('passes through real values for every nullable field when present', () => {
    const dto = TimetableMapper.sessionToDto({
      id: 'cs1',
      class_group_id: 'cg1',
      schedule_id: 's1',
      session_date: '2026-11-10',
      starts_at: new Date('2026-11-10T12:00:00Z'),
      ends_at: new Date('2026-11-10T13:00:00Z'),
      status: 'scheduled',
      tutor_id: 't2',
      meeting_url: 'https://example.test/meet',
      notes: 'Substitute tutor',
      created_at: new Date('2026-01-01T00:00:00Z'),
    });

    expect(dto.scheduleId).toBe('s1');
    expect(dto.tutorId).toBe('t2');
    expect(dto.meetingUrl).toBe('https://example.test/meet');
    expect(dto.notes).toBe('Substitute tutor');
  });
});

describe('TimetableMapper.placementToDto', () => {
  it('keeps a null left_on as undefined (still placed)', () => {
    const dto = TimetableMapper.placementToDto({
      id: 'ce1',
      class_group_id: 'cg1',
      learner_id: 'l1',
      enrolment_id: 'e1',
      joined_on: '2026-11-01',
      left_on: null,
    });

    expect(dto.leftOn).toBeUndefined();
  });

  it('passes through a real left_on (withdrawn)', () => {
    const dto = TimetableMapper.placementToDto({
      id: 'ce1',
      class_group_id: 'cg1',
      learner_id: 'l1',
      enrolment_id: 'e1',
      joined_on: '2026-11-01',
      left_on: '2026-12-01',
    });

    expect(dto.leftOn).toBe('2026-12-01');
  });
});
