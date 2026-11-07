export interface PackagePriceRow {
  id: string;
  package_code: string;
  amount_cents: number;
  effective_from: string;
  effective_to: string | null;
  created_at: Date;
}
