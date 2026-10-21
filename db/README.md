# db — the Skolopals database

The Skolopals database. **This directory is the single source of truth for the schema** — `../web` consumes generated types from it and holds no migrations of its own.

Normalised to 4NF. See `docs/4nf-audit.md` for why each table looks the way it does, and `../docs/SPEC-2026-centre-rebuild.md` for the full design.

---

## Quick start

Nothing to install. You already have Homebrew Postgres 18 running.

```bash
cd db
make reset
```

That creates the database, applies the local Supabase shim, runs every migration, loads the CAPS reference data and verifies the result. Then:

```bash
make psql     # open a shell
make test     # verify + RLS + rules + billing + enrolment (226 assertions)
make help     # everything else
```

Connection string: `postgresql://$(whoami)@localhost:5432/skolopals_dev`

If Postgres isn't running: `brew services start postgresql@18`

---

## How local works without Docker

Supabase provides an `auth` schema, a `storage` schema, the `anon` / `authenticated` / `service_role` roles, and `auth.uid()`. Bare Postgres provides none of that, so migrations referencing them would fail.

`local/` supplies the missing pieces:

| File | Provides |
| --- | --- |
| `00_roles.sql` | `anon`, `authenticated`, `service_role`, plus a safety check (see below) |
| `01_supabase_shim.sql` | `auth` and `storage` schemas, `auth.users`, `auth.uid()`, `auth.role()`, `auth.email()` |
| `02_dev_helpers.sql` | `dev.login_as()`, `dev.login_anon()`, `dev.logout()` for exercising RLS |

**The migrations themselves contain no local-only code.** They are byte-identical to what deploys to Supabase, where `local/` is never applied. `auth.uid()` here has the same body as the real one, reading the same request GUCs, so a policy that works locally works deployed.

### Testing RLS

```sql
select dev.login_as('11111111-1111-1111-1111-111111111111');  -- become a user
select auth.uid(), current_user;
select dev.login_anon();                                       -- become a visitor
select dev.logout();                                           -- back to superuser
```

> ⚠️ **RLS testing is only trustworthy if the test roles are not superusers.**
> `anon`, `authenticated` and `service_role` are **cluster-wide** — shared with every other database on this machine. If one of them inherits from a superuser it bypasses every policy, and local RLS tests pass no matter how broken the policies are.
>
> `make bootstrap` warns if it finds this, and `make verify` fails hard. The fix affects the whole cluster:
> ```bash
> psql -d postgres -c 'revoke <superuser> from authenticated;'
> ```

---

## Full parity (optional)

For real GoTrue auth, Storage and Studio, when you want a pre-deploy check:

```bash
brew install supabase/tap/supabase     # plus Docker Desktop
supabase start
supabase db reset                      # applies migrations/ then seed/
```

Same migration files. Worth running before any deploy that touches auth or storage.

---

## Layout

```
migrations/   applied in filename order, tracked in public.schema_migrations
seed/         idempotent; safe to re-run. Anything matching *test-users* is skipped
local/        local-only Supabase shim. NEVER deployed
scripts/      migrate / seed / verify runners
docs/         ERD, 4NF audit, data dictionary
```

### Migrations

Named `YYYYMMDDHHMMSS_description.sql`, applied once, in their own transaction, recorded in `public.schema_migrations`. **Never edit an applied migration** — add a new one.

### Seeds

| File | Contents | Safe in production? |
| --- | --- | --- |
| `01_reference.sql` | CAPS phases, grades, subjects, offerings, languages, achievement levels, operating hours | **Yes** — factual curriculum data |

Deliberately **not** seeded:

- **`terms`** — official SA school term dates are entered by an administrator before go-live, so the system can never disagree with the schools learners actually attend (BRS D-01).
- **`rooms`** — specific to the centre's premises.

---

## Conventions

| | |
| --- | --- |
| Money | Integer **cents**, ZAR. Never float, never numeric |
| Time | `timestamptz`; displayed in `Africa/Johannesburg` |
| Day of week | ISO-8601 via the `iso_dow` domain: 1 = Monday … 7 = Sunday, matching `extract(isodow from date)` |
| Reference keys | Short stable text codes (`grade_7`, `physical_sciences`) — readable in seeds, FKs and logs |
| Entity keys | `uuid` surrogate keys |
| **Arrays** | **Forbidden in `public`.** A multivalued fact gets its own table. `make verify` enforces this |
| **Views** | Must set `security_invoker = true`, or they bypass RLS. `make verify` enforces this |
| Derived data | Computed in views, never stored. Invoice payment state, tutor ratings and KPIs are all derived |

---

## Deploying

```bash
make migrate DATABASE_URL="postgresql://...@db.<ref>.supabase.co:5432/postgres"
```

`local/` is not applied. Run `make verify` against the target afterwards.

Current project: `dhmjzshlznhqohvkdcpz` (eu-west-2). Note that this puts learner data outside South Africa — see `../docs/POPIA-policy.md` §B3.

---

## Build status

| Phase | Scope | State |
| --- | --- | --- |
| **0** | Scaffold, local shim, reference & curriculum, CAPS seed | **Done** |
| **1** | People, packages, enrolment, timetable, attendance, safeguarding, consent, RLS | **Done** |
| **2** | Programmes, assessment, learning plans, reports, billing, communication, expenses, KPI views | **Done** |

**The database is complete.** Phase 3 (app strip and re-base) is also done; Phases 4–8 remain (`../docs/SPEC-2026-centre-rebuild.md` §8).

## Generating TypeScript types

```bash
make types     # writes ../web/src/lib/database.types.ts
```

`scripts/gen-types.py` introspects the database directly and emits a file
shape-compatible with `supabase gen types typescript`. It exists because the
Supabase CLI needs Docker, which this machine does not have; switching back
later is a drop-in change.

Two things it handles that are easy to get wrong:

- **Extension functions are excluded.** pgcrypto's overloaded `armor`,
  `digest` and friends would otherwise collide as duplicate object keys.
- **Embedding needs single-column foreign keys.** `tutor_competencies` has a
  *composite* FK to `subject_offerings`, which PostgREST cannot use for
  embeds, so migration `015` adds direct FKs to `subjects` and `grades`
  alongside it. Without them `select subjects(name)` fails at runtime, not
  just in the types.

## Tests

```bash
make test
```

| Suite | Asserts |
| --- | --- |
| `verify.sh` | Structure, the 4NF array ban, RLS coverage, privilege boundaries, curriculum and pricing integrity |
| `test-rls.sh` | Real queries as guardian / other guardian / tutor / learner / anon / admin. Proves a tutor is denied health notes, emergency contacts, collectors, billing and consents, and that one family cannot see another's data |
| `test-rules.sh` | The business-rule triggers: teaching competency, operating hours, POPIA consent gating, subject allowance, class capacity, controlled collection, temporal overlap |
| `test-assessment.sh` | Tutor administration and the assessment cycle: create a tutor from an existing account, record competencies with their language of instruction, set pay rates that never overlap, record an assessment (achievement level derived from the mark), write a learning plan that supersedes the last, draft a report the parent cannot see, publish it, and have the parent acknowledge it |
| `test-enrolment.sh` | The whole journey: a parent submits an enrolment, an admin activates it (billing account opened, registration invoice raised), the term's sessions are generated, a tutor marks the register, and the parent sees all of it |
| `test-billing.sh` | The worked example from SPEC §9.3 end to end: invoice numbering and yearly reset, the R1,900 catch-up invoice, 3-day grace, one payment settling three invoices across two children, over-allocation guards, and the full assessment → learning plan → report → acknowledgement chain |

`verify.sh` proves policies **exist**. `test-rls.sh` proves they **work** — the two are not the same, and only the second catches a policy that is present but wrong. Three real defects were found this way and none would have been caught by inspection:

| Found by | Defect |
| --- | --- |
| `verify.sh` | RLS was never enabled on 16 people tables; the policies existed but were never consulted |
| `test-rls.sh` as `anon` | The public tutor directory 500'd for logged-out visitors — `anon` lacked EXECUTE on `private.is_admin()` |
| `test-rls.sh` as a tutor | **`v_account_statement` exposed every family's billing to tutors.** A Postgres view defaults to `security_invoker = false`, so it runs as its owner and bypasses RLS on its base tables |

The last one is the trap worth remembering: **a view silently bypasses RLS unless you set `security_invoker = true`**. `verify.sh` now fails if any view except `v_public_timetable` omits it.

Both test suites run inside a transaction and roll back, so they leave no data behind and are safe to run against a seeded database.
