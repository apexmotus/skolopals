export interface TutorQualificationRow {
  id: string;
  tutor_id: string;
  qualification_type: string;
  title: string;
  institution: string;
  year_awarded: number | null;
  verified_at: Date | null;
  verified_by: string | null;
}
