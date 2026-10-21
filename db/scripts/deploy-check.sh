#!/usr/bin/env bash
# Rehearses a deploy against a throwaway database built WITHOUT the dev
# helpers, the way a real Supabase project is. If any migration or seed has
# quietly come to depend on local-only tooling, this is where it shows.
set -euo pipefail

DB_NAME="skolopals_deploycheck"
DB_USER="$(whoami)"
URL="postgresql://${DB_USER}@localhost:5432/${DB_NAME}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() { dropdb --if-exists "$DB_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "deploy-check: building ${DB_NAME} with no dev helpers"
cleanup
createdb "$DB_NAME"

# Only what Supabase itself provides. Note 02_dev_helpers.sql is NOT applied.
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$DIR/local/00_roles.sql" 2>&1 | grep -v "^NOTICE\|^WARNING\|^ \|^$" || true
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$DIR/local/01_supabase_shim.sql"

DATABASE_URL="$URL" "$DIR/scripts/migrate.sh" | tail -1
DATABASE_URL="$URL" "$DIR/scripts/seed.sh"   | tail -1

echo
echo "Asserting the deployed shape:"

fails=0
check() {
  local desc="$1" sql="$2" result
  result=$(psql "$URL" -tAc "$sql" 2>&1 | tr -d '[:space:]')
  if [ "$result" = "t" ]; then
    printf '  \033[32mPASS\033[0m  %s\n' "$desc"
  else
    printf '  \033[31mFAIL\033[0m  %s  (got: %s)\n' "$desc" "$result"
    fails=$((fails + 1))
  fi
}

check "no dev schema exists" \
  "select count(*) = 0 from information_schema.schemata where schema_name = 'dev'"
# pg_get_functiondef() throws on aggregates, which extensions install into
# public, so restrict to plain functions we own.
check "no function of ours depends on the dev schema" \
  "select count(*) = 0 from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','private')
     and p.prokind = 'f'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and pg_get_functiondef(p.oid) like '%dev.%'"
check "private helpers exist" \
  "select count(*) >= 6 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'"
check "the auth trigger is installed" \
  "select count(*) = 1 from pg_trigger where tgname = 'on_auth_user_created'"
check "the tutor-documents bucket is private" \
  "select not public from storage.buckets where id = 'tutor-documents'"
check "RLS is on every public table" \
  "select count(*) = 0 from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity"
check "reference data loaded" \
  "select count(*) = 13 from public.grades"
check "price list loaded" \
  "select count(*) = 10 from public.packages"
check "terms are empty, as intended" \
  "select count(*) = 0 from public.terms"
check "no test accounts were seeded" \
  "select count(*) = 0 from auth.users"

echo
if [ "$fails" -gt 0 ]; then
  printf '\033[31mdeploy-check failed: %d problem(s)\033[0m\n' "$fails"
  exit 1
fi
printf '\033[32mdeploy-check passed — the migration set stands on its own\033[0m\n'
