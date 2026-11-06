export interface OperatingHourRow {
  day_of_week: number;
  /** `time` column — `pg` returns this as a plain `HH:MM:SS` string, never a `Date` (no date component). */
  opens_at: string;
  closes_at: string;
  purpose: string;
}
