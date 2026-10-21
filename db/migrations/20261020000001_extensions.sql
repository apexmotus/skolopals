-- Extensions and shared conventions.
--
-- Conventions used throughout this schema:
--   * Money is integer cents in ZAR. Never float, never numeric for currency.
--   * Timestamps are timestamptz. Display timezone is Africa/Johannesburg.
--   * Reference tables use short stable text codes as primary keys so that
--     seeds, FKs and debugging output are readable.
--   * Entity tables use uuid surrogate keys.
--   * NO array-typed columns in `public`. Multivalued facts get their own
--     table - see docs/4nf-audit.md. scripts/verify.sh enforces this.

create extension if not exists pgcrypto;

-- Day of week is stored as ISO-8601: 1 = Monday ... 7 = Sunday.
-- Matches extract(isodow from date), so no translation is ever needed.
create domain public.iso_dow as smallint
  check (value between 1 and 7);

comment on domain public.iso_dow is
  'ISO-8601 day of week: 1=Monday .. 7=Sunday. Matches extract(isodow from date).';
