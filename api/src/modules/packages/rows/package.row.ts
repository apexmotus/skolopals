export interface PackageRow {
  code: string;
  name: string;
  description: string;
  service_type: string;
  billing_period: string;
  subject_allowance: number | null;
  is_active: boolean;
  sort_order: number;
}
