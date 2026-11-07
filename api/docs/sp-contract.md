# Stored procedure / function contract

Generated from `../../docs/nestjs-api-plan/02-sp-catalogue.md`, resolved against this API's
actual `*.repository.ts` call sites (not the catalogue's "intended" framing — every parameter
name and shape below is what the code really sends, confirmed by grep across every repository as
of Phase 3f). `02-sp-catalogue.md` is this project's working planning document and keeps its own
pivot/audit narration; this file is the shipped, human-readable contract for a future
DBA/integrator who doesn't need any of that history.

## Error convention

Every Postgres error this API's database layer can produce is mapped by
`src/database/sql-error.mapper.ts` to one of these HTTP responses — a Postgres `SQLSTATE`, not a
SQL Server `THROW` number, since there is no SQL Server anywhere in this stack:

| SQLSTATE | Meaning (this project's convention) | HTTP | Error code |
|---|---|---|---|
| `23505` / `23503` / `23P01` | unique / foreign-key / exclusion violation | 409 | `CONFLICT` |
| `23514` | `check_violation` — a business-rule trigger (capacity, tutor competency, consent, oversettlement) | 422 | `BUSINESS_RULE_VIOLATION` |
| `P0001` | a plain `raise exception 'msg'` with no explicit SQLSTATE — this project's convention for everything from "not signed in" to "administrators only" to "only a pending enrolment can be activated"; the SP's own message is client-safe and surfaced verbatim | 422 | `BUSINESS_RULE_VIOLATION` (a Manager that knows a specific function's contract may catch and re-throw as `NotFoundException`/`ForbiddenException` where it matters — e.g. `tutors.createTutor` on `create_tutor`'s "no such account" case) |
| `23502` / `22P02` | not-null violation / invalid input | 400 | `VALIDATION_FAILED` |
| `42501` | `insufficient_privilege` — a plain-table `INSERT`/`UPDATE`/`DELETE` denied by that row's own RLS policy | 403 | `FORBIDDEN` |
| `40001` / `40P01` | serialization failure / deadlock — logged, retried automatically when the call opted in (`retryOnDeadlock`), then | 503 | `SERVICE_UNAVAILABLE` |
| `ETIMEDOUT` | connection timeout | 504 | `GATEWAY_TIMEOUT` |
| `ECONNREFUSED` / `ECONNRESET` / `ENOTFOUND` | the database is unreachable | 503 | `SERVICE_UNAVAILABLE` |
| anything else | never leaks the SQL message to the client; logged at `error` level with the SQLSTATE and the calling function/statement | 500 | `INTERNAL_ERROR` |

Every error response has the shape `{ status, code, title, detail, traceId, path, timestamp, errors? }`
(`src/common/filters/all-exceptions.filter.ts`).

## Real Postgres functions

RLS is kept live as the real authorization backstop (`04-phase0-schema-port-and-cutover-strategy.md`
§1) — none of these functions take an `ActorUserId`/`ActorIsAdmin` parameter or re-implement a
visibility check RLS already does; `Raises` below only lists what the function itself actually
raises (business rules RLS cannot express as a row-visibility policy), not role-gating, which is
enforced by `@Roles(...)` in the Controller before the call is ever made.

Every call site passes parameters **by name** (`fn(p_foo := $1, ...)`), never positionally — see
`src/database/stored-proc.runner.ts`. An optional, SQL-defaulted parameter (marked *omittable*
below) is left out of the call entirely when the caller didn't supply a value, never passed as an
explicit `null` — a named arg passed as `null` does **not** fall back to the function's own
`default`, only a truly absent argument does.

| Function | Module | Kind | Parameters | Returns | Idempotent |
|---|---|---|---|---|---|
| `public.submit_enrolment` | enrolment | write | `p_learner:jsonb`, `p_package_code:text`, `p_subjects:jsonb`, `p_emergency:jsonb`, `p_collectors:jsonb`, `p_consents:jsonb`, `p_policy_version:text`, `p_preferred_tutor:uuid?` | `uuid` (new enrolment id) | no |
| `public.activate_enrolment` | enrolment | write | `p_enrolment_id:uuid`, `p_assigned_tutor_id:uuid`, `p_start_date:date` *(omittable, defaults `current_date`)*, `p_first_month_cents:int` *(omittable)*, `p_reason:text` *(omittable)* | `uuid \| null` (registration invoice id; `null` if this learner was already charged a registration fee on a prior enrolment) | no — re-activating an already-active enrolment is rejected, not a no-op |
| `public.create_tutor` | tutors | write | `p_email:text`, `p_slug:text`, `p_employment_type:text`, `p_headline:text` (defaulted `''` by the caller, never omitted) | `uuid` (new tutor id) | no |
| `public.set_tutor_competency` | tutors | write | `p_tutor_id:uuid`, `p_subject:text`, `p_grade:text`, `p_languages:text[]` | `uuid` (competency id) | yes — upsert + wholesale replace of its media rows |
| `public.set_tutor_pay_rate` | tutors | write | `p_tutor_id:uuid`, `p_pay_basis:text`, `p_amount_cents:int`, `p_effective_from:date` *(omittable, defaults `current_date`)* | `uuid` (new pay-rate id) | no — atomically closes the previous open rate first |
| `public.package_price_on` | packages | read | `p_package_code:text`, `p_on:date` | `integer \| null` (cents; `null` if no price is in effect) | yes |
| `public.generate_class_sessions` | timetable | write | `p_class_group_id:uuid` | `integer` (count of sessions newly created) | yes — `on conflict do nothing` against `(class_group_id, session_date, starts_at)`, fills only the gap on re-run |
| `public.record_assessment` | assessment | write | `p_learner_id:uuid`, `p_type:text`, `p_grade_code:text`, `p_assessed_on:date`, `p_scores:jsonb`, `p_subject:text?`, `p_term_id:uuid?`, `p_notes:text` (defaulted `''`, never omitted) | `uuid` (new assessment id) | no |
| `public.create_learning_plan` | assessment | write | `p_learner_id:uuid`, `p_goals:jsonb`, `p_assessment_id:uuid?`, `p_term_id:uuid?` | `uuid` (new learning-plan id) | no — supersedes any existing active plan for the learner, atomically, in the same statement batch |
| `public.save_progress_report` | progress-reports | write | `p_learner_id:uuid`, `p_term_id:uuid`, `p_summary:text` (defaulted `''`), `p_subjects:jsonb`, `p_publish:boolean`, `p_attendance_note:text` (defaulted `''`) | `uuid` (report id) | yes — re-saving an unpublished draft updates in place, never duplicates |
| `public.run_monthly_invoices` | billing | write | `p_period:date` *(omittable, defaults to the 1st of next calendar month)* | `table(invoice_id uuid, billing_account_id uuid, total_cents bigint)` — one row per invoice touched | yes — by construction, via the filtered unique index on `(enrolment_id, period_month)`, not a check-then-skip race |
| `public.apply_late_fees` | billing | write | `p_on:date` *(omittable, defaults `current_date`)* | `integer` (count of late-fee lines newly raised) | yes — filtered unique index on `(late_fee_for_invoice_id)` |
| `public.record_payment` | billing | write | `p_billing_account_id:uuid`, `p_amount_cents:int`, `p_method:text`, `p_reference:text` (always passed, defaulted `''`, never omitted — the function also internally `coalesce`s it), `p_paid_on:date` *(omittable, defaults `current_date`)* | `uuid` (new payment id) | no |
| `public.start_thread` | communication | write | `p_subject:text?`, `p_body:text`, `p_participants:uuid[]`, `p_learner_id:uuid?` | `uuid` (new thread id) | no |
| `public.mark_thread_read` | communication | write | `p_thread_id:uuid` | `integer` (count of messages newly marked read) | yes — `insert ... on conflict (message_id, profile_id) do nothing` |

## Everything else

Every other table/view this API reads or writes — the large majority of the schema — is **plain,
parameterized SQL in a `*.repository.ts` file**, never a dedicated function: ordinary
`select`/`insert`/`update`/`delete` against an RLS-protected table, or a `select` against one of
the pre-existing reporting views (`v_invoice_status`, `v_account_statement`, `v_outstanding_fees`,
`v_my_threads`, `tutor_rating_summary`, and the `v_monthly_revenue`/`v_operating_surplus`/... KPI
views `finance` module wraps). This is the same thing PostgREST's `.from(table).select()` /
`.insert()` / `.update()` already did for `web/` before this API existed — see
`src/database/stored-proc.runner.ts`'s own class doc for why this isn't a violation of the "no
inline SQL" rule (the rule is about never building a query from untrusted input in a Manager or
Controller; every `sql` string here is a `const` literal, parameters are always placeholders).

`02-sp-catalogue.md`'s "CRUD SP index" table lists every one of those tables/views, module by
module, if a fuller cross-reference is ever needed — that level of detail is deliberately not
duplicated here, since (unlike the 15 functions above) there is no parameter/return contract to
document beyond "read or write this table's own columns."
