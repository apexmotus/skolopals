#!/usr/bin/env bash
# Loads (or wipes) the UAT test data set. UAT only: refuses any database URL
# that is not the UAT Supabase project.
#
#   ./scripts/seed-uat.sh "<UAT DATABASE_URL>"              seed
#   ./scripts/seed-uat.sh "<UAT DATABASE_URL>" --teardown   wipe operational data
#   ./scripts/seed-uat.sh "<UAT DATABASE_URL>" --reset      wipe, then seed
#
# Use the direct connection or the SESSION pooler (port 5432). The transaction
# pooler (6543) drops session settings between statements, which the guard
# relies on.
set -euo pipefail

UAT_REF="dhmjzshlznhqohvkdcpz"
URL="${1:?usage: seed-uat.sh <UAT DATABASE_URL> [--teardown|--reset]}"
MODE="${2:-seed}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

case "$URL" in
  *"$UAT_REF"*) ;;
  *) echo "Refusing: the URL does not point at the UAT project ($UAT_REF)." >&2; exit 1 ;;
esac
case "$URL" in
  *":6543"*) echo "Refusing: use the direct connection or session pooler (port 5432), not 6543." >&2; exit 1 ;;
esac

run() {
  printf '  > %s\n' "$(basename "$1")"
  # No pager: a paged result set would pause the run mid-transaction.
  psql "$URL" -v ON_ERROR_STOP=1 -q -P pager=off \
    -c "set skp.project_ref = '$UAT_REF'" \
    -f "$1"
}

case "$MODE" in
  seed)       run "$DIR/uat/01_seed_uat.sql" ;;
  --teardown) run "$DIR/uat/99_teardown_uat.sql" ;;
  --reset)    run "$DIR/uat/99_teardown_uat.sql"; run "$DIR/uat/01_seed_uat.sql" ;;
  *) echo "Unknown option: $MODE" >&2; exit 1 ;;
esac
echo "uat: done"
