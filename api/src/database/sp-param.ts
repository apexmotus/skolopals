/**
 * Postgres adaptation of the generic spec's §5.4 typed parameter helpers.
 *
 * There is no TVP/`sql.TVP` equivalent to construct: plain JS values pass
 * straight through as Postgres arrays/`jsonb` via the `pg` driver. What this
 * module still enforces, matching the generic spec's intent, is that every
 * call site names its parameters exactly as the catalogue does (the
 * `p_`-prefixed names every function in `db/migrations/` already uses) and
 * is explicit about `jsonb` encoding — `StoredProcRunner` calls every
 * function with named-parameter syntax (`fn(p_foo := $1, ...)`), never
 * positionally, so a reordering in the catalogue can't silently swap values.
 */
export interface SpParam {
  /** The function's parameter name, WITH its `p_` prefix, exactly as in `db/migrations/`. */
  name: string;
  value: unknown;
}

export const p = {
  text: (name: string, value: string | null): SpParam => ({ name, value }),
  int: (name: string, value: number | null): SpParam => ({ name, value }),
  numeric: (name: string, value: number | null): SpParam => ({ name, value }),
  bool: (name: string, value: boolean | null): SpParam => ({ name, value }),
  uuid: (name: string, value: string | null): SpParam => ({ name, value }),
  date: (name: string, value: string | null): SpParam => ({ name, value }),
  timestamptz: (name: string, value: string | null): SpParam => ({
    name,
    value,
  }),
  /** Postgres `jsonb` parameters must be sent as a JSON string, never a raw JS object. */
  jsonb: (name: string, value: unknown): SpParam => ({
    name,
    value: value === null || value === undefined ? null : JSON.stringify(value),
  }),
  textArray: (name: string, value: readonly string[] | null): SpParam => ({
    name,
    value,
  }),
  uuidArray: (name: string, value: readonly string[] | null): SpParam => ({
    name,
    value,
  }),
};
