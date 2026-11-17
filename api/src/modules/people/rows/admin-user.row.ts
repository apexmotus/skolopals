export interface AdminUserRow {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  roles: string[];
  is_active: boolean;
  created_at: Date;
  total_count?: string | number;
}
