export interface ClassGroupRow {
  id: string;
  name: string;
  subject_code: string;
  language_code: string;
  tutor_id: string;
  term_id: string;
  delivery_mode: string;
  room_id: string | null;
  capacity: number;
  is_active: boolean;
  created_at: Date;
}
