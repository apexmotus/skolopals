#!/usr/bin/env bash
# Creates (or promotes) a superadmin. Usage:
#   DATABASE_URL=... ./create-superadmin.sh <email> <password> [first_name] [last_name]
# Runs create-superadmin.sql with the values passed in as session settings.
# The password goes through the environment, not argv, so it stays out of `ps`.
set -euo pipefail

DB="${DATABASE_URL:?DATABASE_URL not set}"
[ $# -ge 2 ] && [ $# -le 4 ] || { echo "usage: $0 <email> <password> [first_name] [last_name]" >&2; exit 1; }

export SA_EMAIL="$1" SA_PASSWORD="$2" SA_FIRST="${3:-Super}" SA_LAST="${4:-Admin}"
DIR="$(cd "$(dirname "$0")" && pwd)"

psql "$DB" -v ON_ERROR_STOP=1 -q <<SQL
\getenv sa_email SA_EMAIL
\getenv sa_password SA_PASSWORD
\getenv sa_first SA_FIRST
\getenv sa_last SA_LAST
begin;
select set_config('app.sa_email', :'sa_email', true),
       set_config('app.sa_password', :'sa_password', true),
       set_config('app.sa_first_name', :'sa_first', true),
       set_config('app.sa_last_name', :'sa_last', true) \gset
\i $DIR/create-superadmin.sql
commit;
SQL
