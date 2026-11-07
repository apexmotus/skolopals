export interface ExpenseCategoryRow {
  code: string;
  name: string;
  budget_cents: number | null;
  sort_order: number;
}

export interface ExpenseRow {
  id: string;
  category_code: string;
  incurred_on: string;
  amount_cents: number;
  description: string;
  recorded_by: string | null;
  created_at: Date;
}
