export interface TermRow {
  id: string;
  year: number;
  term_number: number;
  /** `date` columns come back as raw `'YYYY-MM-DD'` strings — see database.providers.ts. */
  starts_on: string;
  ends_on: string;
  created_at: Date;
}
