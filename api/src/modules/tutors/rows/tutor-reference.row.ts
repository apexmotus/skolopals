export interface TutorReferenceRow {
  id: string;
  tutor_id: string;
  full_name: string;
  relationship: string;
  phone: string;
  email: string;
  checked_at: Date | null;
  checked_by: string | null;
  outcome: string | null;
}
