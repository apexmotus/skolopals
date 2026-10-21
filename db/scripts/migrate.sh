#!/usr/bin/env bash
# Applies any migration not yet recorded in public.schema_migrations, in
# filename order, each in its own transaction.
set -euo pipefail

DB="${DATABASE_URL:?DATABASE_URL not set}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);

-- Infrastructure, not app data. No API role may read or write the ledger.
-- RLS is enabled with no policy, so even a stray GRANT cannot open it.
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
SQL

applied=0
for file in "$DIR"/migrations/*.sql; do
  version="$(basename "$file" .sql)"
  exists=$(psql "$DB" -tAc "select 1 from public.schema_migrations where version = '$version'")
  if [ "$exists" = "1" ]; then
    printf '  = %s (already applied)\n' "$version"
    continue
  fi
  printf '  + %s\n' "$version"
  psql "$DB" -v ON_ERROR_STOP=1 -q --single-transaction \
    -f "$file" \
    -c "insert into public.schema_migrations (version) values ('$version');"
  applied=$((applied + 1))
done

printf 'migrate: %d applied\n' "$applied"
