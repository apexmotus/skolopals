#!/usr/bin/env bash
# Applies every seed file in order. Seeds are idempotent, so this is re-runnable.
set -euo pipefail

DB="${DATABASE_URL:?DATABASE_URL not set}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

shopt -s nullglob
for file in "$DIR"/seed/*.sql; do
  case "$(basename "$file")" in
    *test-users*) continue ;;   # never auto-applied; local only, git-ignored
  esac
  printf '  > %s\n' "$(basename "$file")"
  psql "$DB" -v ON_ERROR_STOP=1 -q --single-transaction -f "$file"
done
printf 'seed: done\n'
