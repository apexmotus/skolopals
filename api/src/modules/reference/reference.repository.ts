import { Injectable } from '@nestjs/common';
import { StoredProcRunner } from '../../database/stored-proc.runner';
import type { AchievementLevelRow } from './rows/achievement-level.row';
import type { GradeRow } from './rows/grade.row';
import type { LanguageRow } from './rows/language.row';
import type { OperatingHourRow } from './rows/operating-hour.row';
import type { RoomRow } from './rows/room.row';
import type { SchoolPhaseRow } from './rows/school-phase.row';
import type { SubjectOfferingRow } from './rows/subject-offering.row';
import type { SubjectRow } from './rows/subject.row';
import type { TermRow } from './rows/term.row';

/**
 * Plain parameterized reads/writes against the `reference` tables
 * (`db/migrations/20261020000002_reference_curriculum.sql`) — there is no
 * dedicated function for any of these (confirmed: `web/` reads them as
 * ordinary PostgREST table reads today); see `StoredProcRunner`'s class
 * doc for why that's the right call here, not a hard-rule violation.
 */
@Injectable()
export class ReferenceRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  listPhases(): Promise<SchoolPhaseRow[]> {
    return this.sp.selectMany<SchoolPhaseRow>(
      'select code, name, sort_order from public.school_phases order by sort_order',
    );
  }

  listGrades(): Promise<GradeRow[]> {
    return this.sp.selectMany<GradeRow>(
      'select code, name, phase_code, sort_order from public.grades order by sort_order',
    );
  }

  listSubjects(): Promise<SubjectRow[]> {
    return this.sp.selectMany<SubjectRow>(
      'select code, name, description, is_language, sort_order from public.subjects order by sort_order',
    );
  }

  listOfferings(gradeCode: string | null): Promise<SubjectOfferingRow[]> {
    if (gradeCode === null) {
      return this.sp.selectMany<SubjectOfferingRow>(
        'select subject_code, grade_code from public.subject_offerings order by grade_code, subject_code',
      );
    }
    return this.sp.selectMany<SubjectOfferingRow>(
      'select subject_code, grade_code from public.subject_offerings where grade_code = $1 order by subject_code',
      [gradeCode],
    );
  }

  listLanguages(): Promise<LanguageRow[]> {
    return this.sp.selectMany<LanguageRow>(
      'select code, name, sort_order from public.languages order by sort_order',
    );
  }

  listAchievementLevels(): Promise<AchievementLevelRow[]> {
    return this.sp.selectMany<AchievementLevelRow>(
      'select code, label, description, min_percent, max_percent from public.achievement_levels order by code desc',
    );
  }

  listTerms(): Promise<TermRow[]> {
    return this.sp.selectMany<TermRow>(
      'select id, year, term_number, starts_on, ends_on, created_at from public.terms order by starts_on',
    );
  }

  async createTerm(input: {
    year: number;
    termNumber: number;
    startsOn: string;
    endsOn: string;
  }): Promise<TermRow> {
    const result = await this.sp.executeRaw<TermRow>(
      `insert into public.terms (year, term_number, starts_on, ends_on)
       values ($1, $2, $3, $4)
       returning id, year, term_number, starts_on, ends_on, created_at`,
      [input.year, input.termNumber, input.startsOn, input.endsOn],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  listOperatingHours(): Promise<OperatingHourRow[]> {
    return this.sp.selectMany<OperatingHourRow>(
      'select day_of_week, opens_at, closes_at, purpose from public.centre_operating_hours order by day_of_week, opens_at',
    );
  }

  listRooms(): Promise<RoomRow[]> {
    return this.sp.selectMany<RoomRow>(
      'select id, name, capacity, is_active from public.rooms order by name',
    );
  }

  async createRoom(input: {
    name: string;
    capacity: number;
    isActive?: boolean;
  }): Promise<RoomRow> {
    const result = await this.sp.executeRaw<RoomRow>(
      `insert into public.rooms (name, capacity, is_active)
       values ($1, $2, $3)
       returning id, name, capacity, is_active`,
      [input.name, input.capacity, input.isActive ?? true],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }
}
