export interface MedicalNotesRow {
  learner_id: string;
  allergies: string;
  conditions: string;
  medication: string;
  accommodations: string;
  updated_at: Date;
  updated_by: string | null;
}
