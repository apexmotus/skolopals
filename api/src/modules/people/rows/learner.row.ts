export interface LearnerRow {
  id: string;
  profile_id: string | null;
  full_name: string;
  /** `date` column — raw `'YYYY-MM-DD'` string, see database.providers.ts. */
  date_of_birth: string;
  grade_code: string;
  school_name: string;
  home_language_code: string | null;
  status: string;
  joined_on: string;
  left_on: string | null;
  created_at: Date;
}
