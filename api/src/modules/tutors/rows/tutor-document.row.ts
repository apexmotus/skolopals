export interface TutorDocumentRow {
  id: string;
  tutor_id: string;
  doc_type: string;
  storage_path: string;
  uploaded_at: Date;
  verified_at: Date | null;
  verified_by: string | null;
}
