export interface ProgrammeRow {
  id: string;
  name: string;
  description: string;
  programme_type: string;
  starts_on: string;
  ends_on: string;
  capacity: number;
  price_cents: number;
  delivery_mode: string;
  room_id: string | null;
  is_published: boolean;
  created_at: Date;
}
