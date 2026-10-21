# Skolopals — 2026 Rebuild Specification

**Status:** Draft for approval · **Date:** 2026-10-20
**Sources:** `Skolopals_Tutoring_Centre_Detailed_Business_Plan_2026_2030.docx`, the delivered app in `web/`, Supabase project `dhmjzshlznhqohvkdcpz`

---

## 1. Why this is a rebuild, not a patch

The shipped app and the business plan describe two different businesses.

| | Shipped app | Business plan |
| --- | --- | --- |
| Model | Online marketplace | Physical community tutoring centre, Damonsville / Brits, NW |
| Unit of sale | One lesson, booked ad hoc | **Monthly package** (R450–R1,250) + once-off add-ons |
| Who pays | The "student" account | **Parent / guardian**, often for 2–3 children |
| Curriculum | GCSE, A-Level | **CAPS** — Grade R–12, Foundation → FET phases |
| Currency / time | USD, `Europe/London` | **ZAR, `Africa/Johannesburg`** |
| Tutor pay | 40 % / 60 % revenue split | **Centre staff** — salary or per-session rate |
| Scheduling | Tutor publishes open slots | **Fixed weekly timetable**, Mon–Thu 13:00–18:00, Sat 08:00–13:00 |
| Payment | Simulated card checkout | **Invoice, reminder, receipt, statement**; R150 late fee |
| Tutor onboarding | Public self-application | **Admin-created only** |

Near enough every table encodes a marketplace assumption, so the schema is rebuilt from a new baseline rather than migrated forward.

**This is safe.** The remote Supabase project holds only seed data — 6 auth users, 3 tutors, 3 bookings, 150 demo slots. No production records are lost.

---

## 2. Decisions taken (agreed 2026-10-20)

1. **Model** — centre-first with monthly package enrolment; online delivery supported from day one.
2. **Accounts** — parent/guardian account holds one or more learners; a learner may optionally be issued their own login.
3. **Enrolment** — parent picks a package, registers the learner, and may nominate a **preferred tutor**; admin confirms and places the learner.
4. **Billing** — **invoice and record only.** No card gateway. Invoices, reminders, late fees, receipts, statements; admin records EFT/cash payments.
5. **Tutor pay** — centre staff on a salary or per-session rate. The 40/60 split is removed entirely.
6. **Sessions** — **recurring timetabled classes** that learners are enrolled into. One-on-one is a class of capacity 1.
7. **Add-ons** — one-on-one hours, holiday programmes, exam prep and the R150 registration fee are billed as **line items on the parent's invoice**.
8. **Assessment** — the **full cycle**: initial assessment → individual learning plan → monthly monitoring → termly report → parent acknowledgement.
9. **Attendance** — registers **plus safeguarding**: emergency contacts, authorised collectors, sign-in/sign-out log.
10. **Tutor profiles** — staff directory with **ratings and parent reviews** (moderated). No price on the card, no public price filter.
11. **Tutor onboarding** — **admin-only.** The public "Become a Tutor" application is removed.
12. **Delivery mode** — every class is flagged `in_centre` / `online` / `hybrid` from day one.
13. **Also in scope** — admin KPI dashboard, holiday & Saturday programmes, parent statements & receipts.
14. **Not in scope** — the referral programme (plan §14). Schema leaves room; no build this pass.
15. **Database home** — `db/` is canonical. The app's legacy `supabase/` directory is deleted; `web/` keeps only generated types.
16. **Local runtime** — runs on the Homebrew Postgres 18 already on this machine via a Supabase shim; the same files also run under `supabase start` once Docker is installed.

---

## 3. Normalisation to 4NF

### 3.1 What 4NF demands here

Fourth normal form forbids a table from holding **two or more independent multivalued facts** about the same key. The current schema breaks this repeatedly by storing repeating groups in arrays and free text.

### 3.2 Audit of the current schema

| # | Current | Problem | Normal form broken | Fix |
| --- | --- | --- | --- | --- |
| 1 | `tutors.subjects text[]`, `topics text[]`, `languages text[]` | Multiple multivalued facts in one row, forcing a Cartesian product on any join — and conflating language-as-subject, language-of-instruction and language-spoken into one array. See §3.3 | **4NF** (also 1NF) | `tutor_competencies`, `tutor_competency_media`, `tutor_spoken_languages` |
| 2 | `tutors.grades text` (`"7–12"`) | A set encoded as a string. Unqueryable, unjoinable. | **1NF** | `grades` lookup + `tutor_competencies.grade_id` |
| 3 | `tutors.full_name` | Duplicates `profiles.full_name`. Two places to update, two answers possible. | **3NF** | Read from `profiles`; column dropped |
| 4 | `tutors.rating`, `review_count` | Derived from `reviews`, maintained by trigger. | **3NF** (derived data) | `tutor_rating_summary` view |
| 5 | `tutor_applications.documents text[]`, `.subjects text` | Repeating groups. No per-document type, upload date or verification state. | **1NF / 4NF** | `tutor_documents` (table retired with the public application) |
| 6 | `bookings.subject`, `.starts_at`, `.duration_minutes`, `.price_cents` | Copied from the slot and the tutor's rate at write time. | **3NF** | Derived from `class_sessions` + `package_prices` |
| 7 | `payments.booking_id` 1:1 | One payment can only settle one booking. A parent paying R1,900 for two children across three invoices cannot be recorded. | **Relational modelling error** | `payments` + `payment_allocations` (M:N) |
| 8 | `payments.platform_fee_cents`, `.tutor_payout_cents` | Generated 40/60 columns; the business model is gone. | n/a | Dropped |
| 9 | `messages(sender_id, recipient_id, read_at)` | A single `read_at` cannot express "read by the tutor, not yet by the parent" once a thread has three participants. | **4NF** | `message_threads` + `thread_participants` + `message_reads` |
| 10 | `notifications(user_id, audience)` | Disjunctive key — exactly one must be set, nothing enforces it; single `read_at` for a broadcast. | **4NF / BCNF** | `notifications` + `notification_recipients` |
| 11 | `resources(tutor_id, student_id)` both nullable | Four meanings encoded in two nullable columns. | **BCNF** | `resources` + `resource_audiences` |
| 12 | `progress_reports(subject, score_label, trend)` one row per subject | A termly report covering four subjects becomes four unrelated rows with no report identity. | **4NF** | `progress_reports` + `progress_report_subjects` |
| 13 | `profiles.role` single column | In a small community centre a person is plausibly both a parent and a tutor. One column cannot hold both. | **4NF** | `user_roles(user_id, role)` |
| 14 | `profiles.grade_level text` | Grade belongs to a learner, not an account; free text; grade→phase is a functional dependency. | **1NF / 3NF** | `grades` lookup, FK from `learners` |

### 3.3 The judgement call: subject × grade × language

Decomposing a tutor's teaching ability into `tutor_subjects(tutor_id, subject_id)` and `tutor_grades(tutor_id, grade_id)` is only 4NF-correct **if subject and grade are independent** for a given tutor.

They are not. A real tutor teaches *Mathematics for Grades 4–7* and *English for Grades 1–3* — not the cross-product of all four. Splitting them would claim she teaches Grade 1 Mathematics.

**Language is two different facts, and the important one is not independent either.**

1. **Language as a subject.** English, Afrikaans and Setswana are CAPS subjects in their own right. This is just a row in `subjects` — no special handling.
2. **Language as the medium of instruction.** Physical Sciences taught *in English* and Physical Sciences taught *in Afrikaans* are different offerings. A tutor may teach Physical Sciences in Afrikaans but Mathematics in English, and a bilingual tutor may teach the same subject in both.

Medium of instruction therefore depends on *what* is being taught, not on the tutor. Hanging it off the tutor — as `tutor_languages(tutor_id, language_id)` — would assert that a tutor who teaches Maths in English and Phys Sci in Afrikaans can also teach Maths in Afrikaans. That is exactly the spurious cross-product 4NF exists to prevent.

So teaching ability is a ternary relation, with medium of instruction as a multivalued fact *about the competency*:

```sql
tutor_competencies      (id, tutor_id, subject_id, grade_id)   -- unique across the three
tutor_competency_media  (competency_id, language_id)           -- medium(s) of instruction
```

A tutor who teaches Grade 11 Physical Sciences in both English and Afrikaans has one competency row and two media rows. A tutor who teaches it only in Afrikaans has one of each. Neither can be misread as the other.

**Spoken languages are a separate, genuinely independent fact.** Whether a tutor can hold a parent meeting in Setswana has nothing to do with what she teaches — material in Damonsville and Brits, where Setswana is widely spoken. That stays its own binary table, `tutor_spoken_languages(tutor_id, language_id)`, used for parent communication and nothing else.

The same test is applied to `class_group_grades` and `enrolment_subjects`: split only what is actually independent.

---

## 4. Target schema

ZAR throughout, stored as integer cents. All timestamps `timestamptz`; display timezone `Africa/Johannesburg`.

### 4.1 Reference / curriculum

| Table | Purpose |
| --- | --- |
| `school_phases` | `foundation`, `intermediate`, `senior`, `fet` |
| `grades` | Grade R–12 → `phase_code` FK. Grade determines phase, so phase is never stored on a learner |
| `subjects` | CAPS subjects: Mathematics, Mathematical Literacy, English, Afrikaans, Natural Sciences, Social Sciences, Technology, EMS, Geography, History, Life Sciences, Physical Sciences, Accounting, Business Studies, Economics, Life Skills, Reading, Writing |
| `subject_offerings(subject_id, grade_id)` | Which subjects the centre offers at which grade (plan §5) |
| `languages` | English, Afrikaans, Setswana, isiZulu, Sesotho |
| `achievement_levels` | CAPS 7-point scale (1 Not Achieved → 7 Outstanding) with percentage bands |
| `terms` | SA school terms: year, term number, start, end. Anchors termly reports |
| `centre_operating_hours` | Mon–Thu 13:00–18:00, Fri admin, Sat 08:00–13:00 (plan §11). Validates timetabling |
| `rooms` | Name, capacity, in-centre venue |

### 4.2 People

| Table | Notes |
| --- | --- |
| `profiles` | 1:1 with `auth.users`. `full_name`, `phone`, `created_at`. **No `role` column** |
| `user_roles(user_id, role)` | `parent`, `learner`, `tutor`, `admin`. A person may hold several |
| `guardians` | `profile_id` PK, postal/physical address, preferred contact channel |
| `learners` | `full_name`, `date_of_birth`, `grade_id`, `school_name`, `home_language_id`, `profile_id` **nullable** (the optional learner login), `status` |
| `learner_guardians(learner_id, guardian_id, relationship, is_primary, is_billing_contact)` | M:N — two guardians per learner, several learners per guardian |
| `learner_emergency_contacts` | Name, relationship, phone, priority. Repeating group, own table |
| `authorised_collectors` | Who may collect the child, with `active_from` / `active_to` |
| `learner_medical_notes` | Allergies, conditions. POPIA-sensitive — admin-only RLS |
| `tutors` | `profile_id` **not null** (admin-created), `slug`, `headline`, `bio`, `employment_type`, `status`, `photo_url` |
| `tutor_competencies(id, tutor_id, subject_id, grade_id)` | The ternary relation from §3.3; unique across the three |
| `tutor_competency_media(competency_id, language_id)` | **Medium of instruction** — Phys Sci in Afrikaans vs in English. Depends on the competency, not the tutor |
| `tutor_spoken_languages(tutor_id, language_id)` | Languages for **parent communication** only. Genuinely independent of teaching |
| `tutor_qualifications` | Type, institution, year, `verified_at` |
| `tutor_documents` | ID, certificate, police clearance → private Storage bucket |
| `tutor_references` | Name, relationship, contact, `checked_at` (plan §13) |
| `tutor_pay_rates` | `pay_basis` (monthly_salary / per_session / per_hour), `amount_cents`, `effective_from`, `effective_to` |

### 4.3 Products and pricing (plan §9)

`packages` holds *what* is sold; `package_prices` holds *what it costs and when*. Price is temporal — the plan spans 2026–2030 and prices will move. Keeping `price_cents` on `packages` would make the row mean two things and force rewriting history on every increase.

| Code | Name | Billing | Subjects | 2026 price |
| --- | --- | --- | --- | --- |
| `group_1` | Group – 1 subject | monthly | 1 | R450 |
| `group_2` | Group – 2 subjects | monthly | 2 | R750 |
| `group_3` | Group – 3 subjects | monthly | 3 | R950 |
| `all_subject` | All-subject support | monthly | all | R1,100 |
| `homework` | Homework assistance | monthly | — | R500 |
| `academic_plus` | Academic Plus | monthly | all | R1,250 |
| `one_on_one_hr` | One-on-one – 1 hour | per hour | 1 | R180 |
| `one_on_one_4` | One-on-one – 4 lessons | per block | 1 | R650 |
| `registration` | Registration | once-off | — | R150 |
| `holiday` | Holiday programme | per programme | — | R350–R750 (per programme) |

**No discounts.** The tier structure is the whole price list — multi-subject is already priced into the R450 → R750 → R950 steps, and there is no sibling discount. The shipped pricing page's "family and multi-subject discounts" promise is removed as inaccurate. A `discount` value exists in the `invoice_lines.line_type` enum so an admin credit can be recorded if one is ever agreed, but no automatic rule is built.

### 4.4 Enrolment

- `enrolments` — `learner_id`, `package_id`, `status` (pending / active / paused / ended), `start_date`, `end_date`, `preferred_tutor_id` (nullable), `assigned_tutor_id`, `source`
- `enrolment_subjects(enrolment_id, subject_id, preferred_language_id)` — which subjects fill the package's allowance, and the **medium of instruction the parent wants for each**. A parent may ask for Mathematics in English and Physical Sciences in Afrikaans for the same learner. A check constraint holds the subject count to `packages.subject_allowance`

### 4.5 Timetable and attendance

- `class_groups` — `name`, `subject_id`, **`language_id`** (medium of instruction — a class is delivered in one), `tutor_id`, `term_id`, `delivery_mode` (`in_centre`/`online`/`hybrid`), `room_id`, `capacity`. **One-on-one = capacity 1.** A check constraint requires the assigned tutor to hold a matching `tutor_competency_media` row, so *Grade 11 Phys Sci (Afrikaans)* cannot be given to a tutor who only teaches it in English
- `class_group_grades(class_group_id, grade_id)` — a class may span Grades 4–5
- `class_schedules` — `day_of_week`, `starts_at_time`, `ends_at_time`. A class meeting Tue *and* Thu is two rows, validated against `centre_operating_hours`
- `class_sessions` — materialised occurrences: `session_date`, `starts_at`, `ends_at`, `status`, `tutor_id` (substitute override), **`meeting_url`** (set per session for `online`/`hybrid` classes, so a leaked link expires with the session)
- `class_enrolments(class_group_id, learner_id, enrolment_id, joined_on, left_on)` — placement
- `attendance_records` — unique `(class_session_id, learner_id)`; `present`/`absent`/`late`/`excused`, `marked_by`, `note`
- `session_check_ins` — arrival/collection log: `arrived_at`, `signed_in_by`, `departed_at`, `collected_by` → `authorised_collectors` (plan §22 safety)

### 4.6 Holiday & Saturday programmes (plan §5, §23)

`programmes` (name, dates, capacity, delivery mode, price) · `programme_sessions` · `programme_enrolments`

### 4.7 Assessment and progress (plan §12)

- `assessment_types` — initial, monthly, diagnostic, exam_prep
- `assessment_domains` — reading, spelling, comprehension, writing, mathematics, language
- `assessments` — `learner_id`, `type`, `subject_id` (null for the initial all-round assessment), `administered_by`, `assessed_on`, `term_id`
- `assessment_scores(assessment_id, domain_id, raw_score, max_score, achievement_level_id)` — unique per pair; the 4NF fix for per-domain results
- `learning_plans` — `learner_id`, `from_assessment_id`, `term_id`, `created_by`, `status`
- `learning_plan_goals` — `subject_id`, `goal`, `target_level_id`, `target_date`, `status`
- `progress_reports` — `learner_id`, `term_id`, `tutor_id`, `issued_on`, `summary`, `published_at`
- `progress_report_subjects` — per subject: `achievement_level_id`, strengths, areas for improvement, recommended intervention
- `report_acknowledgements(progress_report_id, guardian_id, acknowledged_at, comment)` — the plan's "parent feedback" step

### 4.8 Billing (plan §20)

- `billing_accounts` — one per billing guardian
- `invoices` — `invoice_number` unique, `period_start/end`, `issued_on`, `due_on`, `status` (draft / issued / part_paid / paid / overdue / written_off)
- `invoice_lines` — `line_type` (package / add-on / registration / programme / late_fee / adjustment), description, qty, unit amount, total
- `payments` — `paid_on`, `amount_cents`, `method` (eft / cash / card_offline), `reference`, `recorded_by`
- `payment_allocations(payment_id, invoice_id, amount_cents)` — **M:N.** One payment settles several invoices; one invoice takes several payments
- `credit_notes` + `credit_note_allocations`
- `billing_settings` — temporal, `effective_from`: `invoice_prefix` (`SKP`), `issue_day` (15), `due_day` (1 of the following month), `grace_days` (3), `late_fee_cents` (R150)
- `invoice_sequences(year, last_number)` — produces `SKP-2026-0001`, resetting each January, allocated under a row lock so concurrent runs cannot collide
- `v_account_statement` — view: invoices, payments, credits, running balance

### 4.9 Communication

- `message_threads` · `thread_participants` · `messages` · `message_reads(message_id, profile_id, read_at)`
- `notifications` · `notification_recipients(notification_id, profile_id, read_at)`
- `contact_enquiries` — public form, with `status` and `source` to feed the enquiry KPI
- `reviews` — `tutor_id`, `guardian_id`, `rating`, `comment`, `status` (pending / published / rejected), moderated by admin
- `resources` · `resource_audiences` — target a learner, a class group, a grade or everyone

### 4.10 Finance & KPIs (plan §17, §24)

`expense_categories` + `expenses` make the plan's operating budget (rent R5,000, electricity R1,500, internet R700, tutor payments R10,000, …) recordable, so **operating surplus** is computable rather than illustrative.

Views: `v_monthly_revenue`, `v_monthly_expenses`, `v_operating_surplus`, `v_outstanding_fees`, `v_revenue_per_learner`, `v_attendance_rate`, `v_assessment_improvement`, `v_learner_retention`, `v_enquiry_funnel`, `v_tutor_session_load`.

### 4.11 Security

RLS on every table. Helpers stay in the `private` schema, following the existing pattern.

| Role | Can see |
| --- | --- |
| `parent` | Only their own learners — enrolments, attendance, assessments, reports, invoices, statements, threads |
| `learner` | Only themselves, and only if issued a login: timetable, own reports, resources, threads |
| `tutor` | Only learners in classes they teach; their own pay rates and sessions. **No access to billing** |
| `admin` | Everything |
| `anon` | Published tutor profiles, published reviews, packages & current prices, programmes, public pages |

`learner_medical_notes`, `tutor_documents` and `tutor_references` are admin-only. **Tutors are explicitly denied health notes and all billing tables.**

POPIA governs everything here — the data subjects are mostly children. See **`docs/POPIA-policy.md`** for the privacy notice, the cross-border transfer assessment and the implementation checklist. Three requirements land directly on the schema:

- `consents` — per-purpose, versioned, withdrawable. Enrolment is unlawful without the s35 guardian consent
- `data_retention_policies` + `v_retention_due` + `data_retention_log` — 5-year retention enforced by a monthly purge job with admin confirmation
- `learners.left_on` — starts the retention clock

---

## 5. Repository layout

```
skolopals/                             ← the git repo (apexmotus/skolopals)
├─ web/                                the Next.js app
│  ├─ src/
│  │  └─ lib/database.types.ts         generated from db/
│  ├─ public/
│  └─ package.json
├─ db/                                 ← canonical database
│  ├─ README.md                        run-it-locally instructions
│  ├─ Makefile                         db-create / migrate / seed / reset / test / types
│  ├─ local/                           Supabase shim: roles, auth, storage, dev helpers
│  ├─ migrations/                      15 files, applied in order
│  ├─ seed/                            CAPS reference, packages, POPIA, assessment, expenses
│  ├─ scripts/                         migrate / seed / verify / test-rls / test-rules / test-billing / gen-types
│  └─ docs/                            ERD, 4NF audit
├─ docs/
│  ├─ BRS-skolopals-2026.md            business requirements
│  ├─ SPEC-2026-centre-rebuild.md      ← this file
│  └─ POPIA-policy.md                  privacy notice + compliance annex
└─ README.md
```

**Layout decision (revised 2026-10-20).** One repo holds the app, the database and the documentation as three siblings. Phases 3–8 change the schema and the app together — a migration, its regenerated types and the components that use them are one logical change — so they belong on one branch, in one commit.

> ⚠️ **The app is no longer at the repo root.** Vercel's **Root Directory** project setting must be changed to `web`, or builds fail with *"no package.json found"*. This is a dashboard setting; it cannot be set from `vercel.json`.

The legacy `supabase/` directory is deleted. One source of truth.

---

## 6. Running the database locally

Your machine has **Postgres 18.4 (Homebrew), running**, superuser `mollomponya`. It has **no Docker and no Supabase CLI**, so the primary path uses what is already there.

### Path A — bare Postgres (works today, zero installs)

```bash
cd db
make db-create     # createdb skolopals_dev
make migrate       # shim + every migration in order
make seed          # CAPS reference data, the plan's packages, POPIA, expenses
make test          # verify + RLS + business rules + billing (159 assertions)
```

Or simply `make reset`, which does all four from nothing.

Connection string: `postgresql://mollomponya@localhost:5432/skolopals_dev`

`local/01_supabase_shim.sql` supplies what Supabase would otherwise provide: the `auth` and `storage` schemas, an `auth.users` table, `auth.uid()` / `auth.jwt()` / `auth.role()` reading from a session GUC, and the `anon` / `authenticated` / `service_role` roles. **The migration files themselves contain no local-only code** — they are the same files that deploy to Supabase. RLS is exercisable locally via `select private.set_test_user('<uuid>')`.

### Path B — Supabase CLI (full parity, when you want it)

```bash
brew install supabase/tap/supabase       # plus Docker Desktop
cd db && supabase start        # real GoTrue, Storage, Studio on :54323
supabase db reset                        # applies migrations/ + seed/
```

Same migration files, real Auth and Storage. The README documents this as the pre-deployment check.

### Deploying to Supabase

`supabase db push` from `db/`, or `apply_migration` via MCP against `dhmjzshlznhqohvkdcpz`. Because only seed data exists remotely, the first deploy drops and rebuilds the public schema.

---

## 7. Application changes

### 7.1 Removed

| What | Why |
| --- | --- |
| `/become-a-tutor` + `application-form.tsx` + `/submitted` | Tutor onboarding is admin-only |
| `/admin/applications/**` | No applications to review |
| `/book/[slug]/**` — the 3-step checkout | No per-lesson card purchase |
| `book_lesson()`, `cancel_booking()`, `review_application()` RPCs | Marketplace logic |
| Simulated card capture, `card_last4`, the `0002` decline | No gateway |
| 40 % / 60 % split; tutor "earnings" revenue-share screens | Tutors are staff |
| `availability_slots` and the slot picker | Replaced by the class timetable |
| USD `money()`, `Europe/London`, GCSE / A-Level grades | ZAR, `Africa/Johannesburg`, CAPS |
| Price filter and price-sort on tutor search | Price comes from the package |

### 7.2 Public site

| Route | Change |
| --- | --- |
| `/` | SA copy: Damonsville / Brits, *"Learning Today. Succeeding Tomorrow."*, CAPS phases, the plan's value chain (Assessment → Learning Plan → Tutoring → Homework → Testing → Report → Parent feedback) |
| `/pricing` | The plan's package table in ZAR, with registration fee and holiday programme range. Optional market-comparison panel (plan §8) |
| `/subjects` | CAPS subjects grouped by phase, per plan §5 |
| `/tutors` | **"Our Tutors"** staff directory — photo, subjects, grades, qualifications, languages, rating and published reviews. No price, no price filter |
| `/tutors/[slug]` | Profile + reviews + "Request this tutor" into the enrolment flow |
| `/enrol` **(new)** | Package → learner details → subjects → preferred tutor → emergency contacts → submit. Produces a `pending` enrolment |
| `/timetable` **(new)** | Operating hours and the term class timetable |
| `/programmes` **(new)** | Holiday and Saturday programmes with dates and prices |
| `/contact` | Enquiry with source, feeding the enquiry KPI |
| `/about`, `/safeguarding`, `/terms` | Real SA content; safeguarding describes sign-in/sign-out and controlled collection |
| `/privacy` | Renders Part A of `docs/POPIA-policy.md`, replacing the GDPR-shaped placeholder |

### 7.3 Parent portal (replaces `/student`)

Dashboard (learners, next sessions, account balance) · Learners (details, grade, school, emergency contacts, authorised collectors) · Enrolments & packages · Timetable & attendance per learner · Assessments & learning plan · Termly reports with acknowledgement and feedback · **Invoices, statement, receipts** · Messages · Resources

### 7.4 Learner portal (optional login)

Timetable · Own reports · Resources · Messages. No billing, no sibling data.

### 7.5 Tutor portal

My classes & weekly schedule · **Attendance register** per session (incl. sign-in/sign-out at the centre) · Capture assessments and per-domain scores · Draft learning plans and termly reports · My learners · Messages · **Sessions taught and pay rate** (replaces the earnings/revenue-share screen). No billing access.

### 7.6 Admin

Tutors — create and manage staff, competencies, qualifications, documents, references, pay rates · Learners & guardians · **Enrolment queue** — approve, assign tutor, place into classes · **Timetable builder** — terms, class groups, schedules, generate sessions · **Billing** — monthly invoice run, record payments, apply late fees, statements, receipts · Programmes · Expenses · **KPI dashboard** (plan §24) · Enquiries · Review moderation · Announcements

---

## 8. Delivery phases

| Phase | Contents | Gate |
| --- | --- | --- |
| ~~**0 — Foundation**~~ ✅ | `db/` scaffold, local shim, Makefile, reference & curriculum migrations, CAPS seed | **Done** — `make reset` green on local Postgres |
| ~~**1 — Core schema**~~ ✅ | People, packages & pricing, enrolment, timetable, attendance, safeguarding, consents & retention, RLS | **Done** — RLS exercised per role; tutor denied health notes and billing |
| ~~**2 — Assessment & billing schema**~~ ✅ | Programmes, assessment cycle, learning plans, reports, invoices, payments, allocations, statements, communication, expenses, KPI views | **Done** — 159 assertions; SPEC §9.3 reproduced end to end |
| ~~**3 — App: strip & re-base**~~ ✅ | Delete marketplace surfaces, ZAR + `Africa/Johannesburg`, CAPS vocabulary, regenerate types, parent/learner/tutor/admin shells | **Done** — build, lint and typecheck clean; 45 routes, no dead links |
| ~~**4 — App: enrolment & timetable**~~ ✅ | `/enrol`, admin enrolment queue, timetable builder, tutor registers, parent timetable view | **Done** — the journey is covered end to end by `test-enrolment.sh` |
| ~~**5 — App: assessment & reporting**~~ ✅ | Tutor administration, assessment capture, learning plans, termly reports, parent acknowledgement | **Done** — the §12 cycle is covered by `test-assessment.sh` |
| ~~**6 — App: billing & KPIs**~~ ✅ | Invoice run, payment recording, late fees, statements, receipts, expenses, messaging, admin KPI dashboard | **Done** — a month closes end to end in `test-month-close.sh` |
| ~~**7 — Public site & content**~~ ✅ | Home, pricing, subjects, tutors, programmes, timetable, contact, POPIA notice | **Done** — real centre details throughout; no marketplace copy remains |
| **8 — Deploy** | Supabase rebuild, generated types, smoke test | Remote matches local |

**Phases 0–2 are complete: the database is done.** 75 tables, 18 views, 157 RLS policies, 159 passing assertions. Phases 3–8 are application work.

---

## 9. Billing and operating rules (resolved 2026-10-20)

| # | Rule | Decision |
| --- | --- | --- |
| 1 | **Invoice numbering** | `SKP-2026-0001` — prefix, year, 4-digit sequence. Resets each January |
| 2 | **Issue date** | The **15th** of the preceding month |
| 3 | **Due date** | The **1st** of the month being billed — so November's invoice is issued 15 October and due 1 November. Billing is in advance, with 17 days' notice |
| 4 | **Grace period** | **3 days.** The R150 late fee is applied from the 4th, as a `late_fee` line on the next invoice |
| 5 | **Discounts** | **None.** No sibling or multi-subject discount; the package tiers are the whole price list. The pricing page's existing discount promise is removed |
| 6 | **Pro-rata** | **Admin sets the first month per enrolment.** No automatic rule — `enrolments.first_month_amount_cents` (nullable; null means full package price) with `set_by` and `reason` for the audit trail |
| 6b | **Mid-month enrolment** | On activation, an **immediate invoice for the R150 registration fee only**, due on issue — it secures the place. Tuition joins the normal cycle: the next 15th run bills **every unbilled period** for the enrolment, plus the month ahead |
| 7 | **Term dates** | **Admin-entered, not seeded.** Ship the term admin screen empty; dates are captured before go-live. Demo seed uses clearly-labelled placeholder terms that never reach production |
| 8 | **Online meeting links** | **Per session**, on `class_sessions.meeting_url`, so a leaked link expires with the session |
| 9 | **Data retention** | **5 years** after a learner leaves, aligned to SARS record-keeping. See the POPIA policy below |

### 9.1 The billing cycle

An invoice issued on the **15th of month M−1** covers **month M** and falls due on the **1st of M**. So the run on 15 October bills November, due 1 November.

### 9.2 Worked example — joining before the 15th

A learner joins **5 October 2026** on *Group – 2 subjects* (R750/month). Admin sets the October part-month at R400.

| Date | Invoice | Lines | Total | Due |
| --- | --- | --- | --- | --- |
| 5 Oct | `SKP-2026-0042` | Registration | **R150** | On issue |
| 15 Oct | `SKP-2026-0051` | Oct part-month R400 + November R750 | **R1,150** | 1 Nov |
| 15 Nov | `SKP-2026-0063` | December R750 | **R750** | 1 Dec |

### 9.3 Worked example — joining after the 15th

Same learner, joining **18 October** instead. The 15 October run has already gone, so the next one is 15 November — and it has to catch up October *and* November as well as billing December.

| Date | Invoice | Lines | Total | Due |
| --- | --- | --- | --- | --- |
| 18 Oct | `SKP-2026-0042` | Registration | **R150** | On issue |
| 15 Nov | `SKP-2026-0051` | Oct part-month R400 + November R750 + December R750 | **R1,900** | 1 Dec |
| 4 Dec | — | If unpaid, R150 `late_fee` queued | — | — |
| 15 Dec | `SKP-2026-0063` | January R750 + late fee R150 | **R900** | 1 Jan |

> **Consequence worth knowing.** Anyone joining between the 16th and month-end gets a three-period first invoice, and has had roughly six weeks of tuition before paying for any of it. Given that the plan names non-payment as its top risk (§22), two mitigations are built in and neither needs a rule change:
> 1. Admin can set the first-month amount to **R0** for a late-month joiner, dropping the example to R1,500.
> 2. Admin can issue the catch-up **off-cycle** at activation rather than waiting for the 15th.
>
> If this shape turns out to be unwelcome in practice, the cleanest fix is to invoice tuition at activation for anyone joining after the 15th. Flagging it now rather than discovering it in month two.

### 9.4 Settled

- **Information Officer** — the owner / centre manager, per POPIA's default for a private body. Specific name and contact details still to be supplied; see `docs/POPIA-policy.md`.
- **Mid-month enrolment** — resolved above as rule 6b.

---

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| Rebuild is wider than a schema change — it touches nearly every route | Phased delivery with a working build at each gate; no long-lived broken state |
| Supabase Auth cannot be fully emulated on bare Postgres | Shim covers `auth.uid()` and roles, which is what RLS needs; Path B (Supabase CLI) is the pre-deploy parity check |
| Learner logins add a second authenticated surface to secure | Learner role gets the narrowest policy set; RLS assertions in `make verify` cover it explicitly |
| Billing built without a gateway may later need one | `payments` / `payment_allocations` are gateway-agnostic; adding a provider means a new `method` and a webhook, not a reshape |
| 4NF decomposition raises join counts on hot paths | Reporting goes through views; `tutor_rating_summary` can become materialised if measured to be slow |
| POPIA exposure on children's data | `docs/POPIA-policy.md`: per-purpose consent, admin-only RLS on health and document tables, enforced 5-year retention. **Blocking before go-live:** register the Information Officer (s55) and get Part A reviewed by an attorney |
| Data hosted in London — children's data leaves SA (s72) | Lawful on three independent grounds, documented in the policy's Annex B3, with explicit consent captured at enrolment |

---

## 11. Approval

Confirm §2 reads correctly and give answers to §9 where you have them, and Phase 0 starts.
