export interface ProfileRow {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  phone: string | null;
  created_at: Date;
}
