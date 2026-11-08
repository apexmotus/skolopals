import type { SubmitEnrolmentDto } from './dto/submit-enrolment.dto.js';
import { EnrolmentMapper } from './enrolment.mapper.js';

/**
 * `08-phase3b-...md` task 2: the DTO→jsonb assembly for `submit_enrolment`
 * is where a silently-dropped field would hide, so every field the
 * Postgres function reads (confirmed against
 * `db/migrations/20261020000016_enrolment_rpcs.sql`) gets its own
 * assertion here — not just a round-trip "it doesn't crash" check.
 */
describe('EnrolmentMapper.toSubmitPayload', () => {
  const fullDto: SubmitEnrolmentDto = {
    learner: {
      fullName: 'Alex Learner',
      dateOfBirth: '2013-04-02',
      gradeCode: 'grade_7',
      schoolName: 'Brits Primary',
      homeLanguageCode: 'afrikaans',
      relationship: 'mother',
    },
    packageCode: 'group_2',
    subjects: [
      { subjectCode: 'mathematics', preferredLanguageCode: 'english' },
      { subjectCode: 'afrikaans' },
    ],
    emergencyContacts: [
      {
        fullName: 'Aunt Jo',
        relationship: 'aunt',
        phone: '0831112222',
        priority: 1,
      },
    ],
    collectors: [
      {
        fullName: 'Uncle Bob',
        relationship: 'uncle',
        phone: '0833334444',
        idNumberLast4: '1234',
      },
    ],
    consents: [
      { consentTypeCode: 'popia_processing', granted: true },
      { consentTypeCode: 'marketing', granted: false },
    ],
    policyVersion: '1.0',
    preferredTutorId: 'tutor-1',
  };

  it('maps every learner field to its snake_case jsonb key', () => {
    const payload = EnrolmentMapper.toSubmitPayload(fullDto);

    expect(payload.learner).toEqual({
      full_name: 'Alex Learner',
      date_of_birth: '2013-04-02',
      grade_code: 'grade_7',
      school_name: 'Brits Primary',
      home_language_code: 'afrikaans',
      relationship: 'mother',
    });
  });

  it('maps every subject, preserving order, including one with no preferred language', () => {
    const payload = EnrolmentMapper.toSubmitPayload(fullDto);

    expect(payload.subjects).toEqual([
      { subject_code: 'mathematics', preferred_language_code: 'english' },
      { subject_code: 'afrikaans', preferred_language_code: undefined },
    ]);
  });

  it('maps every emergency contact field, including priority', () => {
    const payload = EnrolmentMapper.toSubmitPayload(fullDto);

    expect(payload.emergencyContacts).toEqual([
      {
        full_name: 'Aunt Jo',
        relationship: 'aunt',
        phone: '0831112222',
        priority: 1,
      },
    ]);
  });

  it('maps every collector field, including id_number_last4', () => {
    const payload = EnrolmentMapper.toSubmitPayload(fullDto);

    expect(payload.collectors).toEqual([
      {
        full_name: 'Uncle Bob',
        relationship: 'uncle',
        phone: '0833334444',
        id_number_last4: '1234',
      },
    ]);
  });

  it('maps every consent, preserving both granted and withheld entries', () => {
    const payload = EnrolmentMapper.toSubmitPayload(fullDto);

    expect(payload.consents).toEqual([
      { consent_type_code: 'popia_processing', granted: true },
      { consent_type_code: 'marketing', granted: false },
    ]);
  });

  it('passes packageCode, policyVersion and preferredTutorId through unchanged', () => {
    const payload = EnrolmentMapper.toSubmitPayload(fullDto);

    expect(payload.packageCode).toBe('group_2');
    expect(payload.policyVersion).toBe('1.0');
    expect(payload.preferredTutorId).toBe('tutor-1');
  });

  it('defaults subjects and collectors to an empty array when omitted, never undefined (the function expects jsonb arrays, not null)', () => {
    const minimalDto: SubmitEnrolmentDto = {
      learner: {
        fullName: 'Minimal Learner',
        dateOfBirth: '2013-04-02',
        gradeCode: 'grade_7',
      },
      packageCode: 'group_1',
      emergencyContacts: [
        { fullName: 'Guardian', relationship: 'mother', phone: '0820000000' },
      ],
      consents: [{ consentTypeCode: 'popia_processing', granted: true }],
      policyVersion: '1.0',
    };

    const payload = EnrolmentMapper.toSubmitPayload(minimalDto);

    expect(payload.subjects).toEqual([]);
    expect(payload.collectors).toEqual([]);
    expect(payload.preferredTutorId).toBeUndefined();
  });

  it('never drops the emergency contacts array even when it has exactly one entry', () => {
    const minimalDto: SubmitEnrolmentDto = {
      learner: {
        fullName: 'Minimal Learner',
        dateOfBirth: '2013-04-02',
        gradeCode: 'grade_7',
      },
      packageCode: 'group_1',
      emergencyContacts: [
        { fullName: 'Guardian', relationship: 'mother', phone: '0820000000' },
      ],
      consents: [{ consentTypeCode: 'popia_processing', granted: true }],
      policyVersion: '1.0',
    };

    const payload = EnrolmentMapper.toSubmitPayload(minimalDto);

    expect(payload.emergencyContacts).toHaveLength(1);
  });
});
