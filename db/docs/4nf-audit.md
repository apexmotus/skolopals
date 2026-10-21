# 4NF audit

Why each table looks the way it does. Expanded per phase.

## The test applied throughout

Fourth normal form forbids a table from holding **two or more independent multivalued facts** about the same key. The practical question for every design choice here:

> Are these two facts independent of each other for a given key?
> **Yes** → separate tables. **No** → one relation covering them together.

Splitting dependent facts is as wrong as combining independent ones: it invents a cross-product that was never true.

## Automated enforcement

`scripts/verify.sh` fails the build on:

| Check | Catches |
| --- | --- |
| No array-typed column in `public` | The repeating group, the commonest 4NF violation |
| Every table has a primary key | Tables with no identified key |
| RLS enabled on every table | Security gaps |
| `anon`/`authenticated` cannot write any table | Over-granting |
| No Supabase role inherits from a superuser | A test role that silently defeats RLS |

The array ban is deliberately absolute. The old schema's `subjects text[]`, `topics text[]`, `languages text[]`, `grades text` and `documents text[]` are the defect this rebuild exists to correct, so the guard is a hard failure rather than a warning.

## Phase 0 decisions

### Grade determines phase — so phase is stored once

`grades.phase_code` holds the grade→phase fact. A learner stores only a grade.

Putting `phase` on a learner alongside `grade` would be a transitive dependency (learner → grade → phase) and permit the contradiction *Grade 2, FET Phase*.

### `subject_offerings` is a relation, not a decomposition

Subject and grade are **not** independent. The centre offers Accounting at FET only, Reading at Foundation only. The pair *is* the fact.

Contrast with the tutor model in Phase 1, where the same reasoning produces a **ternary** relation `tutor_competencies(tutor_id, subject_id, grade_id)` — because a tutor who teaches Maths at Grades 4–7 and English at Grades 1–3 does not teach Grade 1 Maths.

### Medium of instruction is not an attribute of a tutor

Recorded in Phase 1, decided here. Language is **two different facts**:

1. **Language as a subject** — English, Afrikaans and Setswana are CAPS subjects. Ordinary rows in `subjects`, flagged `is_language`.
2. **Language as medium of instruction** — Physical Sciences taught *in Afrikaans* versus *in English*.

The second depends on what is being taught. Storing it as `tutor_languages(tutor_id, language_id)` would assert that a tutor who teaches Maths in English and Physical Sciences in Afrikaans also teaches **Maths in Afrikaans** — a spurious cross-product.

So medium attaches to the competency (`tutor_competency_media`), while **languages a tutor speaks for parent communication** — genuinely independent of what they teach — stay a separate binary table.

### Achievement bands are constrained, not trusted

`achievement_levels` carries a GiST exclusion constraint preventing overlapping percentage ranges, and `verify.sh` asserts the bands tile 0–100 exactly. Seed data correctness is not assumed.

`terms` carries the same treatment: no two terms may overlap, in any year.

### Reference keys are text codes

`grade_7`, `physical_sciences`, `foundation`. Stable, readable in seeds and FKs, and they make a wrong join obvious on sight. Entity tables use `uuid`.

## Phase 1 decisions

### Role is a table, not a column

`user_roles(user_id, role)`. In a small community centre a parent is plausibly also a tutor. A single `role` column cannot hold both, which makes role a multivalued fact about a person — 4NF.

### Teaching ability is ternary; medium hangs off it

```
tutor_competencies     (id, tutor_id, subject_code, grade_code)
tutor_competency_media (competency_id, language_code)
tutor_spoken_languages (tutor_id, language_code)
```

Three tables because there are three distinct facts, with different dependencies:

| Fact | Depends on | Table |
| --- | --- | --- |
| Teaches *subject* at *grade* | the pair, jointly | `tutor_competencies` |
| Teaches it *in a language* | the competency | `tutor_competency_media` |
| *Speaks* a language to parents | the tutor alone | `tutor_spoken_languages` |

A bilingual tutor teaching Grade 11 Physical Sciences in both English and Afrikaans has one competency row and two media rows. A tutor who teaches Maths in English and Physical Sciences in Afrikaans cannot be misread as teaching Maths in Afrikaans.

`tutor_competencies` carries a composite FK to `subject_offerings(subject_code, grade_code)`, so a tutor cannot be recorded as competent in something the centre does not offer at that grade. `test-rules.sh` proves Accounting at Grade 4 is rejected.

### Price is temporal, not an attribute

`package_prices(package_code, amount_cents, effective_from, effective_to)` with a GiST exclusion constraint against overlap. The plan runs 2026–2030; prices will change, and holding price on `packages` would force rewriting history. `package_price_on(code, date)` is the single place that lookup lives.

The same shape applies to `tutor_pay_rates` and `billing_settings`.

### The repeating groups that are now tables

| Was going to be an array | Is now |
| --- | --- |
| emergency contacts | `learner_emergency_contacts`, keyed by priority |
| authorised collectors | `authorised_collectors`, with active dates |
| qualifications, documents, references | three tables, each with verification state |
| days a class meets | `class_schedules`, one row per day |
| grades a class covers | `class_group_grades` |

### Consent is per purpose, versioned and withdrawable

`consents` records the policy version, so when the notice changes you know who agreed to what. Required consents are enforced by a trigger: an enrolment cannot reach `active` without them. POPIA s35 is a database constraint here, not a UI convention.

## Phase 2 decisions

### Payment is many-to-many with invoice

```
payments             (id, billing_account_id, amount_cents, method, ...)
payment_allocations  (payment_id, invoice_id, amount_cents)
```

The old schema had `payments.booking_id` — strictly 1:1. A parent paying R2,500 by one EFT to settle three invoices across two children simply could not be recorded. `test-billing.sh` asserts exactly that case.

Both directions are guarded: a payment cannot be allocated beyond its own value, and an invoice cannot be settled beyond its total by payments plus credits.

### Invoice payment state is derived, never stored

`invoices.status` holds workflow only — `draft`, `issued`, `cancelled`, `written_off`. Whether an invoice is unpaid, part paid, paid or overdue is computed in `v_invoice_status` from its allocations.

A stored `payment_status` would drift the instant a payment is corrected or reallocated, and nothing in the schema could prevent it.

### Tutor rating is a view, not two columns

The old `tutors.rating` and `tutors.review_count` were trigger-maintained duplicates of what `reviews` already says. `tutor_rating_summary` derives both. If it ever measures slow, it becomes a materialised view — still one source of truth.

### Assessment scores are rows, not columns

`assessment_scores(assessment_id, domain_code, raw_score, max_score, …)` with a unique key on the pair. The alternative — six columns on `assessments`, or the old `progress_reports.score_label` free text — makes "how has reading changed since the initial assessment?" unanswerable. `v_assessment_improvement` answers it directly.

`percent` is a stored generated column. That is same-row derivation, which cannot drift, so it does not conflict with DR-06.

### Progress reports have an identity

Old: one row per subject, with no report to belong to — a four-subject termly report was four unrelated rows. Now `progress_reports` is the report and `progress_report_subjects` carries per-subject detail, so a report can be published once, acknowledged once, and shown as a whole.

### Threads, not sender/recipient pairs

`messages.read_at` cannot express "read by the tutor, not yet by the parent" once a thread has three participants. Read state belongs to the (message, person) pair:

```
message_threads · thread_participants · messages · message_reads
```

The same reasoning fixes `notifications`, whose old `user_id` XOR `audience` was a disjunctive key nothing enforced, with a single `read_at` for a broadcast to many people.

### Resource audience has an explicit discriminator

Old: `resources(tutor_id, student_id)`, both nullable — four meanings in two columns, none checked. Now `resource_audiences` carries `audience_type` plus a CHECK that exactly the matching column is set.

### Programme attendance is a separate table

A single attendance table covering both class sessions and programme sessions would need either a nullable FK pair (a disjunctive key again) or a session supertype both inherit. Both cost more than the duplication, and real foreign keys are worth keeping. `v_attendance` unions the two for the KPI.

## Security invariants the schema enforces

| Invariant | Enforced by |
| --- | --- |
| No array column in `public` | `verify.sh`, hard failure |
| Every view sets `security_invoker = true` | `verify.sh` — a view otherwise bypasses RLS entirely |
| `anon` may insert only `contact_enquiries`, and never update or delete | `verify.sh` |
| `authenticated` may write only an explicit allow-list | `verify.sh` |
| No Supabase role inherits from a superuser | `verify.sh` + a bootstrap warning |
| Tutors reach no billing, health, consent or safeguarding data | `test-rls.sh`, as a real tutor |
| One family cannot see another's anything | `test-rls.sh`, as a second guardian |
| Enrolment is impossible without POPIA s35 consent | Trigger; `test-rules.sh` |
