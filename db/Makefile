# Skolopals database.
#
#   make reset    rebuild from nothing (the one you want most days)
#   make verify   assert the schema and seed are sound
#   make psql     open a shell against the local database
#
# Override the target database with DATABASE_URL, e.g.
#   make migrate DATABASE_URL="postgresql://...supabase.co:5432/postgres"

DB_NAME    ?= skolopals_dev
DB_HOST    ?= localhost
DB_PORT    ?= 5432
DB_USER    ?= $(shell whoami)
DATABASE_URL ?= postgresql://$(DB_USER)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)

export DATABASE_URL

PSQL := psql "$(DATABASE_URL)" -v ON_ERROR_STOP=1

.PHONY: help db-create db-drop bootstrap migrate seed reset verify test test-rls test-rules test-billing test-enrolment test-assessment test-month-close deploy-check psql types supabase-start check-pg

help:
	@echo "Skolopals database — $(DATABASE_URL)"
	@echo
	@echo "  make reset          db-create + bootstrap + migrate + seed  (full rebuild)"
	@echo "  make db-create      create the database if absent"
	@echo "  make db-drop        DROP the database (asks first)"
	@echo "  make bootstrap      local-only Supabase shim: roles, auth, storage, dev helpers"
	@echo "  make migrate        apply pending migrations"
	@echo "  make seed           apply seed data (idempotent)"
	@echo "  make verify         structural and curriculum assertions"
	@echo "  make test           verify + RLS + business-rule tests"
	@echo "  make deploy-check   rehearse a deploy on a throwaway database"
	@echo "  make psql           open a psql shell"
	@echo "  make types          regenerate TypeScript types into skolopals-web"
	@echo "  make supabase-start full-parity local stack (needs Docker + Supabase CLI)"

check-pg:
	@pg_isready -h $(DB_HOST) -p $(DB_PORT) >/dev/null 2>&1 || { \
		echo "Postgres is not accepting connections on $(DB_HOST):$(DB_PORT)."; \
		echo "Start it with:  brew services start postgresql@18"; exit 1; }

db-create: check-pg
	@psql "postgresql://$(DB_USER)@$(DB_HOST):$(DB_PORT)/postgres" -tAc \
		"select 1 from pg_database where datname='$(DB_NAME)'" | grep -q 1 \
		|| createdb -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) $(DB_NAME)
	@echo "database: $(DB_NAME) ready"

db-drop: check-pg
	@printf 'Drop database "%s"? This destroys all local data. [y/N] ' "$(DB_NAME)"; \
	read ans; [ "$$ans" = "y" ] || { echo "cancelled"; exit 1; }; \
	dropdb --if-exists -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) $(DB_NAME); \
	echo "dropped $(DB_NAME)"

# Local only. These objects exist already on Supabase and are never deployed.
bootstrap: db-create
	@echo "bootstrap: local Supabase shim"
	@for f in local/*.sql; do echo "  > $$f"; $(PSQL) -q -f "$$f"; done

migrate: check-pg
	@echo "migrate: $(DATABASE_URL)"
	@./scripts/migrate.sh

seed: check-pg
	@echo "seed: $(DATABASE_URL)"
	@./scripts/seed.sh

verify: check-pg
	@./scripts/verify.sh

test-rls: check-pg
	@./scripts/test-rls.sh

test-rules: check-pg
	@./scripts/test-rules.sh

test-billing: check-pg
	@./scripts/test-billing.sh

test-enrolment: check-pg
	@./scripts/test-enrolment.sh

test-assessment: check-pg
	@./scripts/test-assessment.sh

test-month-close: check-pg
	@./scripts/test-month-close.sh

test: verify test-rls test-rules test-billing test-enrolment test-assessment test-month-close
	@echo
	@echo "All suites passed."

reset: db-create bootstrap migrate seed test
	@echo
	@echo "Database rebuilt: $(DATABASE_URL)"

deploy-check: check-pg
	@./scripts/deploy-check.sh

psql: check-pg
	@$(PSQL)

types:
	@python3 scripts/gen-types.py ../web/src/lib/database.types.ts

supabase-start:
	@command -v supabase >/dev/null 2>&1 || { \
		echo "Supabase CLI not installed. See README section 'Full parity'."; exit 1; }
	supabase start
