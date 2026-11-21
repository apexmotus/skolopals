# Implementation Spec — Enrolment, PayShap Payments, Student IDs and UI Refresh

Spec version: 0.5 (all decisions D1–D15 made by owner on 2026-11-21)
Date: 2026-11-21
Scope: `apps/client`, `apps/admin`, `packages/ui`, `packages/shared`, `api/`, `db/`
Supersedes: SPEC-2026-centre-rebuild.md **rule 6** (admin-discretion first month) and **rule 6b**
(registration invoiced on activation). Everything else in that spec stands.

---

## 0. Summary

| # | Change | Outcome |
|---|---|---|
| 1 | Tutor onboarding wizard | Admin adds a tutor in one guided flow. No prior website sign-up needed. |
| 2 | Responsiveness | Web and Admin work properly at 360 px and up: mobile nav drawer, tables become cards, full-screen dialogs. |
| 3 | PayShap payment flow | Once the application is **accepted**, the parent pays by PayShap, confirms, uploads proof. Admin checks the proof and records the payment. A stepper shows every step. |
| 4 | Report card, aptitude test, application review, learner list/detail | Enrolment requires the current report card and ends with an adaptive aptitude test. Admin reviews the report card and test result, then accepts or declines. Admin gets a learner list, and a detail page with downloads and results. |
| 5 | Pre-paid billing | The first payment is the registration fee plus pro-rated tuition for the rest of the current month. |
| 6 | Student ID | Once payment is verified the learner gets a Student ID they can log in with. |
| 7 | Dark purple + yellow theme | New tokens built from the existing brand palette. |

### 0.1 The new parent journey, start to finish

```
 ENROL                          ASSESS          REVIEW (admin)       PAY                            DONE
 ┌──────────────────────────┐   ┌──────────┐    ┌───────────────┐    ┌─────────────────────────┐    ┌────────────┐
 │1 Package 2 Child          │─▶│7 Aptitude│─▶ │Admin reads    │─▶ │P1 Review P2 Pay PayShap │─▶ │Student ID  │
 │3 Report card 4 Subjects   │   │  test    │    │report card +  │    │P3 Upload proof          │    │issued,     │
 │5 Tutor 6 Safety+consent   │   │(~20 min) │    │test result    │    │P4 Awaiting verification │    │login made  │
 └──────────────────────────┘   └──────────┘    └───────────────┘    └─────────────────────────┘    └────────────┘
   enrolment row (pending)        attempt saved   ACCEPT → registration  payment_submission            admin verifies
   created at step 6, no invoice  per answer      invoice raised, parent  status machine                → record_payment
                                                  notified · DECLINE →
                                                  reason, journey ends
```

**No payment can be made before the application is accepted** (D4). The aptitude result and the report
card are the evidence the admin uses to accept or decline.

Every screen in this journey shows the same **journey header** (Enrol › Assess › Review › Pay › Done)
with the current sub-step ("Step 3 of 4: Upload proof of payment"). If the parent leaves at any point, the parent
portal shows a "Continue enrolment for Thandi" card that takes them back to the exact step. The step is
**derived from stored facts** and never kept in its own column (see §4.5), which follows the house rule
that derived state is not stored (`v_invoice_status`).

### 0.2 Cross-cutting rules for the implementer

1. **New work goes through the NestJS API** (Controller → Manager → Repository → StoredProcRunner).
   New server actions call `api.*` the way `admin/users/actions.ts` does, not `supabase.rpc`. Where a
   touched screen still calls Supabase directly (`enrol/actions.ts`, `admin/tutors/actions.ts`), move it
   to the API as part of the change.
2. **Every schema change is a migration in `db/migrations/`** with tests in the existing db test
   suites, followed by `make types`.
3. **Files go to private buckets through signed URLs only.** The browser uploads directly to a signed
   upload URL from the API, then confirms with the API. Downloads use short-lived signed URLs (60 s).
   Generalise `FileStorageService` (today it is hard-wired to `tutor-documents`) to take a bucket name.
4. **Money is integer cents** throughout. Rounding happens in exactly one SQL function (§5.2).
5. **POPIA**: report cards, aptitude results and proofs of payment are personal information about a
   child or a family. Add each to `data_retention_policies`. Reads are limited to admin plus exactly the
   roles §4.2 and §4.3 allow (the learner's tutors for report cards, the guardian for their own child).
   Log every document download. Never log file contents or paths with names in them.
6. **iPhone photos (HEIC/HEIF) are accepted for every upload** (D7). Buckets allow `image/heic` and
   `image/heif`. When the API confirms an upload it converts HEIC to JPEG and replaces the original, so
   previews and downloads always work in any browser. Use `heic-convert` (pure JS/WASM, runs on Vercel).
   `sharp`'s prebuilt binaries cannot decode HEIC.

---

## 1. Tutor onboarding (item 1)

### 1.1 Problems today
- The tutor has to sign up on the public website **before** an admin can add them, and the admin has to
  type the email exactly (`createTutor` → `create_tutor` RPC).
- After creation, competencies, pay rate, spoken languages and status are separate forms on the detail
  page. Nothing tells the admin what is still missing before the tutor can be timetabled.
- The API already has qualifications, documents and references endpoints
  (`tutors.controller.ts:165–236`), but the admin UI has no screens for them. Vetting is invisible.

### 1.2 New flow: `/admin/tutors/new`, a 5-step wizard

| Step | Fields | Backend |
|---|---|---|
| 1. Person | First name, last name, email, phone | If the email has no account: invite (reuse `POST /people/users` with role `tutor`; the invite email lets them set a password). If an account exists: attach the tutor role. Either way a `tutors` row is created **now** as `status = 'onboarding'`, so the wizard can resume. |
| 2. Profile | Headline, bio, employment type, start date, photo (optional); slug auto-generated from the name and editable | `PATCH /tutors/:id` |
| 3. Teaching | A **grid**: subjects as rows, grades as columns, tick cells; per ticked row choose languages of instruction. Spoken languages as chips. Cells the centre does not offer (`subject_offerings`) are disabled, not rejected after submit. | `PUT /tutors/:id/competencies` (bulk), `PUT /tutors/:id/spoken-languages` |
| 4. Pay | Basis, amount (R), effective from | `PUT /tutors/:id/pay-rates` |
| 5. Vetting | Upload ID, police clearance, qualifications, CV; add 1–2 references. Each can be "add later". | `POST /tutors/:id/documents` (signed upload), `/qualifications`, `/references` |
| Review | Checklist with ticks: account invited/accepted · profile · ≥1 competency · pay rate · police clearance (optional) · references (optional). **Activate tutor** is enabled once the required items are done. | `PATCH /tutors/:id/status` → `active` |

- Wizard state lives in the database, so the URL is `/admin/tutors/new?id=<tutorId>&step=3` and survives a refresh.
- The tutors list gets a **Readiness** column ("3 of 5 done") and filters for Onboarding, Active and Suspended.
- The detail page `/admin/tutors/[id]` reuses the wizard's step components in tabs (Profile, Teaching,
  Pay, Vetting, Classes) so the add and edit screens are the same UI.

### 1.3 Schema
- `tutors.status` check: add `'onboarding'`. Onboarding tutors are excluded from `searchTutors`,
  preferred-tutor lists and class assignment. Existing RLS policy `profiles_public_read_active_tutors`
  already filters on active.
- New SP `create_tutor_for_person(p_profile_id, p_employment_type)` replaces the email lookup in
  `create_tutor`.
- **Required-for-activation** rule lives in one SP, `tutor_activation_checklist(p_tutor_id)` returns rows
  `(item, done, required)`, used by both the review step and `set_tutor_status`. That SP refuses
  `active` while a required item is missing.

> **Decided (D1):** a police clearance is **not required** to activate a tutor for now. The checklist
> still lists it as an optional item ("Police clearance: not uploaded") so the gap stays visible.
> Making it required later is a one-line change in `tutor_activation_checklist`.

---

## 2. Responsiveness (item 2)

### 2.1 Targets
Breakpoints to verify: **360, 390, 768, 1024, 1280 px**. No horizontal page scroll anywhere. Touch targets
≥ 44×44 px. Form inputs ≥ 16 px font (prevents iOS zoom-on-focus). Minimum body text is 13 px. Today
there are many 11 px labels; raise them to 12 px.

### 2.2 Shared components (`packages/ui`), where most of the win is

| Component | Today | Change |
|---|---|---|
| `AppShell` | On mobile the sidebar becomes a full-width block of wrapped nav pills above the content (`app-shell.tsx:128–135`), so the page starts far down the screen. | `< md`: a sticky 56 px top bar (logo, current section title, menu button) with a slide-in **drawer** for navigation and the profile card. Focus trap, Esc to close, close on route change. `≥ md`: unchanged sidebar. `≥ md` and `< lg`: collapsible icon-only rail. |
| `DataTable` | `min-w-[560px]` with horizontal scroll. | `< md`: render each row as a **card**. The `primary` column becomes the card title and the other columns become label/value rows. Add optional `href` per row, so the whole card is tappable. `≥ md`: table as now. |
| `Dialog` (new) | none | Centred modal `≥ sm`. **Full-screen sheet** `< sm` with sticky header and sticky action footer. Used by the payment flow and confirmations. |
| `Stepper` (new) | Titles like "1. Choose a package" | Horizontal labelled steps `≥ md`. Compact "Step 3 of 6 · Subjects" with a progress bar `< md`. Completed steps are clickable to go back. `aria-current="step"`. |
| `Field` rows | Mixed `md:flex-row` | Standard `FieldRow`: one column `< md`, two columns `≥ md`. |
| `PageHeading` | n/a | Actions wrap under the title on mobile. |

### 2.3 Page work
- **Admin**: timetable builder (most complex; becomes day-by-day accordion on mobile), billing,
  applications queue and review page (§4.4), learners (§4.6), tutors (§1). Admin is mostly used on a desktop, but verification of
  payments **must** work well on a phone (an admin checking proofs on the go).
- **Client**: public pages, the enrol wizard, the parent portal, the learner portal, the tutor register
  (tutors mark attendance on phones, so treat this as priority).

### 2.4 Verification
Add a Playwright project at the `iPhone 13` and `Pixel 7` viewports to the existing smoke scripts
(`apps/*/scripts/smoke.mjs`). Assert there is no horizontal overflow
(`document.documentElement.scrollWidth <= innerWidth`) on every route in the smoke list.

---

## 3. PayShap payment flow (item 3)

> **Decided (D2):** **PayShap**, South Africa's instant-payment rail. A payee's handle is a **ShapID**
> (usually a cell number or a bank-issued ID). UI copy says "PayShap" and "ShapID" throughout. The
> centre's actual ShapID and account name are entered by an admin in `payment_settings` before go-live.

There is **no gateway integration**. PayShap has no merchant callback for this use. The flow is
"pay in your banking app, then upload proof", and an admin verifies it. That fits the existing
"invoice and record only" billing design.

### 3.1 Parent flow: `PaymentDialog`, 4 steps, always showing "Step n of 4"

| Step | Screen | Primary action |
|---|---|---|
| P1 Review | Invoice breakdown: registration fee + tuition for 21–30 Nov (10 of 30 days) = total. Invoice number. | **Continue to payment** |
| P2 Pay | Large, copyable **ShapID**, account name, **exact amount** (copy button), **reference = invoice number** (copy button). Short help: "Open your banking app → Pay → PayShap → enter the ShapID". | **I have made the payment** (records `marked_paid_at`) |
| P3 Upload proof | Drag/drop or camera capture (`accept="image/*,application/pdf"`, `capture` on mobile). Optional fields: date paid, amount paid (defaults to invoice total), bank reference. Max 10 MB, JPG/PNG/PDF/HEIC. iPhone photos are accepted and converted to JPEG (§0.2 rule 6). | **Submit proof** |
| P4 Awaiting verification | "We're checking your payment. We'll let you know as soon as it's confirmed." Shows what was submitted. Dialog can be closed. | **Go to my portal** |
| (Outcome) Verified | "Payment confirmed. Thandi's Student ID is **SK26-0042**". Leads to §6 set-password step. | **Set Thandi's password** |
| (Outcome) Rejected | Admin's reason ("Amount does not match"). Returns to P3 with the earlier upload shown. | **Upload new proof** |

- The dialog is reachable only once the enrolment is **accepted** (§4.4). The acceptance message (email and
  in-app) links straight to it. It also opens from the parent portal's "Continue enrolment" card and from
  **Account → invoice** for any unpaid invoice. The same component pays monthly invoices later on, which
  is a free win.
- The step shown is derived from the latest `payment_submissions` row for the invoice (§3.3), so closing
  the dialog never loses progress.
- The parent gets an email or in-app message on verify or reject (use existing `communication` module).

### 3.2 Admin flow: `/admin/payments` (new nav item "Payments", with a count badge)

- **Queue**: submitted proofs, oldest first. Columns: family, learner(s), invoice, invoice total, amount
  claimed, submitted at. A mismatch between claimed and invoiced amount is flagged in warning colour.
- **Review page** `/admin/payments/[submissionId]`: the proof inline (image viewer with zoom, or embedded
  PDF) plus a download button. Next to it: invoice lines, account balance, PayShap reference the parent
  typed, and previous submissions for this invoice.
- **Verify** form: amount received (default = claimed), date received, bank reference. Confirm dialog.
  The SP `verify_payment_submission` (§3.3) records the payment with `method = 'payshap'` and the
  existing allocation logic in `record_payment` settles the invoice. For a registration invoice it then
  activates the enrolment and places the learner automatically (§4.7). The invoice then shows as paid via
  `v_invoice_status`, and nothing extra is stored.
- **Reject** form: reason required (pick-list + free text). Parent notified.
- Verification is **idempotent**: a submission can be verified once (`payment_id` unique). A second click
  gets "Already verified by X at 10:42".

### 3.3 Schema

```sql
-- Centre's PayShap details, editable by admin, temporal like billing_settings
create table public.payment_settings (
  id              uuid primary key default gen_random_uuid(),
  payshap_id      text not null,          -- ShapID shown to parents
  account_name    text not null,          -- "Skolopals Tutoring Centre"
  bank_name       text not null default '',
  instructions    text not null default '',
  effective_from  date not null,
  effective_to    date,
  exclude using gist (daterange(effective_from, effective_to, '[)') with &&)
);

create table public.payment_submissions (
  id                    uuid primary key default gen_random_uuid(),
  invoice_id            uuid not null references public.invoices (id) on delete restrict,
  billing_account_id    uuid not null references public.billing_accounts (id) on delete restrict,
  submitted_by          uuid not null references public.profiles (id),
  marked_paid_at        timestamptz not null default now(),   -- clicked "I have made the payment"
  proof_storage_path    text,                                  -- null until uploaded
  proof_mime            text,
  proof_uploaded_at     timestamptz,
  claimed_amount_cents  integer check (claimed_amount_cents > 0),
  claimed_paid_on       date,
  payer_reference       text not null default '',
  status                text not null default 'awaiting_proof'
    check (status in ('awaiting_proof', 'submitted', 'verified', 'rejected', 'withdrawn')),
  reviewed_by           uuid references public.profiles (id),
  reviewed_at           timestamptz,
  rejection_reason      text,
  payment_id            uuid unique references public.payments (id),
  created_at            timestamptz not null default now(),
  check ((status = 'submitted') <= (proof_storage_path is not null)),
  check ((status = 'verified') = (payment_id is not null)),
  check ((status = 'rejected') <= (rejection_reason is not null))
);
-- one open submission per invoice
create unique index on public.payment_submissions (invoice_id)
  where status in ('awaiting_proof', 'submitted');

alter table public.payments drop constraint payments_method_check,
  add constraint payments_method_check check (method in ('eft','cash','card_offline','payshap','other'));
```

- Storage bucket **`payment-proofs`** (private, 10 MB, jpeg/png/pdf). Path
  `{billing_account_id}/{submission_id}/{uuid}.{ext}`. No storage RLS for guardians: uploads go through
  API-issued signed upload URLs scoped to that exact path.
- RLS: guardian reads their own account's submissions; admin reads and writes all.
- SPs: `start_payment_submission(invoice)`, `attach_payment_proof(submission, path, mime, amount, date, ref)`,
  `verify_payment_submission(submission, amount, paid_on, reference)` (calls `record_payment` in the
  same transaction. For a registration invoice it then assigns the §6 Student ID, calls
  `activate_enrolment` and `auto_place_enrolment` (§4.7), and raises next month's invoice when due (§5.3)),
  `reject_payment_submission(submission, reason)`.

---

## 4. Report card, aptitude test, admin learner pages (item 4)

### 4.1 Enrolment wizard restructure (`/enrol`)

The single long form (`enrol-form.tsx`, 6 cards) becomes a `Stepper` wizard. Each step validates before
"Next". Values stay in client state until submit (the existing `EnrolState.values` pattern).

| Step | Content | Change |
|---|---|---|
| 1 Package | as today | — |
| 2 About your child | as today | — |
| 3 Report card | **Required, no exceptions** (D3). Upload the most recent school report (PDF/JPG/PNG/HEIC, ≤ 10 MB). Ask for the year and term it covers. The step cannot be skipped. Help text: "No school report yet? Contact the centre before applying." | new |
| 4 Subjects | as today | — |
| 5 Preferred tutor | as today | — |
| 6 Safety & consent | Merge today's steps 5 and 6. **Review summary** with an **estimate** of the first payment ("If accepted today, your first payment would be R300", §5) and a note that payment is requested only after acceptance. | changed |
| → Submit | Creates learner + enrolment (`pending`). **No invoice yet.** The report card upload is confirmed against the new learner id. | changed |
| 7 Aptitude test | §4.3. Launches straight after submit. "Do it later" is allowed (resumes from the portal), but the application **is not sent for review until the test is complete**. | new |
| → Done | "Thank you. Thandi's application is with the centre for review. We'll let you know as soon as a decision has been made." (replaces `/enrol/submitted`) | changed |

Upload mechanics for the report card: the file is chosen at step 3, but the learner id does not exist
until submit. So step 3 uploads to a staging path `staging/{profile_id}/{uuid}` through a signed URL,
and `submit_enrolment` receives the staging path and moves it to `learner-documents/{learner_id}/…`
(API does the move after the SP succeeds). A cleanup job deletes staging objects older than 24 h.

### 4.2 Schema: learner documents

```sql
create table public.learner_documents (
  id              uuid primary key default gen_random_uuid(),
  learner_id      uuid not null references public.learners (id) on delete cascade,
  doc_type        text not null check (doc_type in ('report_card', 'other')),
  academic_year   smallint check (academic_year between 2015 and 2100),
  term            smallint check (term between 1 and 4),
  storage_path    text not null,
  original_name   text not null,
  mime            text not null,
  size_bytes      integer not null check (size_bytes > 0),
  uploaded_by     uuid not null references public.profiles (id),
  uploaded_at     timestamptz not null default now()
);
```

Bucket **`learner-documents`** (private; all reads and writes go through API signed URLs). Who can see a
report card:

| Role | Access |
|---|---|
| Admin | List, download, replace |
| Tutor (D5) | List and download for learners they teach: the enrolment's assigned tutor, or the tutor of any class the learner is placed in. Access ends when the placement ends. |
| Guardian | List and download their own child's documents. Replace while the stage is `review`. |

Every download is written to `document_access_log`. Enforce access in one SQL function,
`private.can_read_learner_document(p_learner_id)`, used by both RLS and the download SP.
`submit_enrolment` refuses an enrolment with no report card.

### 4.3 Aptitude test

**Source material.** `aptitude_test.json` (bank v1.0.0) validated by `aptitude_test.schema.json`. Bank
analysis:

| Section | Items in bank | Served | Shape |
|---|---|---|---|
| Literacy | 15 = 5 passages × 3 items | 12 (= 4 passages) | P1 d1–2, P2 d2–3, P3 d3–4, P4 d4–5, P5 d5 |
| Logic | 40 = 4 skills × 5 levels × 2 | 13 | 8 items at every difficulty level |

The literacy bank is thin. "Adaptive" there means choosing **which 4 of the 5 passages** to serve, which in
practice means dropping P1 or P5. That is fine for v1. Note it as a content risk: more passages would make
the literacy band estimate much better.

**Storage: the bank lives in the database** (db is the source of truth):

```
aptitude_banks      (version pk, test_id, title, instructions, blueprint jsonb, adaptive jsonb,
                     scoring jsonb, difficulty_bands jsonb, is_current bool)
aptitude_passages   (bank_version, id, title, text)
aptitude_items      (bank_version, id, section, skill, subskill, difficulty, passage_id, stem,
                     options jsonb, answer_id)            -- answer_id: NO grant to authenticated
aptitude_attempts   (id, learner_id, enrolment_id, bank_version, status in_progress|completed|abandoned,
                     current_difficulty, started_at, completed_at,
                     final_band, level_label, literacy_pct, logic_pct)
aptitude_responses  (attempt_id, seq, item_id, section, difficulty_served, chosen_option,
                     is_correct, answered_at, ms_taken, primary key (attempt_id, seq))
```

- A seed generator, `db/seed/aptitude/load.mjs`, validates the JSON with **Ajv (draft 2020-12)** plus the
  checks the schema cannot express: `answerId` ∈ option ids, ids unique, every `passageId` exists,
  blueprint counts are achievable. It then emits an idempotent SQL seed. Add this as a db test.
- `answer_id` is **never** selectable by parent or learner roles (column-level revoke). The browser only
  ever receives the stem, options and passage of the current item.

**Selection algorithm** (API `AptitudeManager`, a pure function that is unit-tested; persisted through SPs):

1. Start at `startDifficulty` (3). Interleave sections: a passage block (3 literacy items), then 3–4 logic
   items, repeat, so a young child is not faced with 12 reading questions in a row.
2. **Logic item**: pick an unused item at `current_difficulty`. Rotate skills (pattern → analogy →
   odd-one-out → if-then). Correct → +1, wrong → −1, clamped to 1–5.
3. **Literacy block**: pick the unused passage whose difficulty range is closest to `current_difficulty`.
   Serve its 3 items together. Adjust difficulty by the block result (≥ 2/3 correct → +1; ≤ 1/3 → −1).
4. Stop at 25 items (12 + 13). The early-stop rule from the bank notes ("when the estimate is stable") is
   **off in v1**: always 25, so results stay comparable.
5. **Final band** = rounded mean difficulty of the last 10 items served, weighted by correctness
   (for each item, the difficulty if correct, or difficulty − 1 if wrong; clamp 1–5). Map it to
   `scoring.levels` (Emerging 1–2, Developing 3, Secure 4, Extending 5). Sub-scores are percent correct
   per section.
6. Flag the result as **"low confidence"** when the final band is more than 2 levels away from the
   learner's grade band (for example a Grade 10 learner landing on band 1). The tutor should re-check in
   person.

**UX** (`/enrol/[enrolmentId]/assessment`):
- An intro screen addressed to the child: what it is, ~20 minutes, "it's not a pass or fail test". For
  Grade R–3 it shows the bank's note: a grown-up may read the questions aloud.
- One question per screen. Passage stays visible above its questions (on mobile, a collapsible "Read the
  story again"). Large tap targets for A–D. Progress "Question 7 of 25". No back button (adaptive), no
  correct/incorrect feedback.
- Each answer is saved on tap (`POST /aptitude/attempts/:id/answers`), so a lost connection or closed tab
  resumes at the next question.
- The end screen does **not** show a score to the child: "Well done, you're finished!" → "Application
  sent for review" screen.

**Who sees results**:

| Role | Sees | When |
|---|---|---|
| Admin | Everything: band, level label, literacy % and logic %, `tutorNote`, confidence flag, per-item breakdown | As soon as the test is complete |
| Learner's tutors | Same as admin except the per-item breakdown | From placement |
| Guardian (D6) | Level label, literacy % and logic %, and "What this means" (the level's `tutorNote`) on the parent learner page | **Once the admin has accepted or declined**, so the result reaches the family together with the decision rather than while it is still under review |
| Learner | Nothing. The end screen stays score-free. | — |

The per-item breakdown is **never** shown to guardians or learners, because it would reveal the item bank.

### 4.4 Application review: accept or decline (admin) — new, from D4

**`/admin/enrolments`** becomes the **Applications** queue. Default filter `stage = review` (test done,
awaiting a decision), oldest first, with an age indicator. Other tabs: Awaiting payment, Needs placement,
Declined.

**`/admin/enrolments/[id]`**, the review page, shows everything the decision needs on one screen:

| Panel | Content |
|---|---|
| Applicant | Name, age, grade, school, home language, guardian(s) |
| Requested | Package, subjects + medium, preferred tutor |
| Report card | Inline preview (image/PDF) + download (access-logged), year and term |
| Aptitude | Band, level label, literacy % and logic %, `tutorNote`, low-confidence flag, item breakdown |
| Capacity hint | Classes for that grade/subject with free seats (existing timetable data); "no suitable class" warning |

Actions:
- **Accept**: confirm dialog shows the amount the parent will be asked for (registration + pro-rata from
  **today**, §5). SP `accept_enrolment(p_enrolment_id)` sets status `accepted`, records `accepted_at` /
  `accepted_by`, opens the billing account if needed, and **raises the registration invoice** in the same
  transaction. The parent is notified with a link to the payment dialog.
- **Decline**: reason required (pick-list: "No class available for this grade/subject", "Needs a
  different programme", "Incomplete information", Other + free text). Optional message to the parent.
  Uses the existing `POST /enrolments/:id/decline`, extended with a reason. No invoice exists, so
  nothing needs to be refunded.
- **Request more information**: sends a message to the parent (existing messaging) without changing the
  stage. For example, to ask for a clearer report card. Replacing the report card from the parent portal
  is allowed while the stage is `review`.
- Accept is **refused** unless the aptitude attempt is completed and a report card is on file.
  There is no admin override (D15). Every application is completed online. A walk-in family uses a
  centre tablet to fill in the same wizard and take the test, signed in to the parent's own account.

Schema:
```sql
alter table public.enrolments drop constraint enrolments_status_check,
  add constraint enrolments_status_check
    check (status in ('pending', 'accepted', 'active', 'paused', 'ended', 'declined'));
alter table public.enrolments
  add column accepted_at     timestamptz,
  add column accepted_by     uuid references public.profiles (id),
  add column decline_reason  text,
  add check ((status = 'accepted') <= (accepted_at is not null)),
  add check ((status = 'declined') <= (decline_reason is not null));
```
The existing `active ⇔ start_date not null` check is unaffected. `activate_enrolment` now requires
status `accepted` (not `pending`) **and** a settled registration invoice.

### 4.5 Derived enrolment progress

A view `v_enrolment_progress (enrolment_id, stage, next_action)` derives the stage from facts:

| Stage | Rule | Who acts |
|---|---|---|
| `details` | enrolment `pending`, no report card | parent |
| `assessment` | enrolment `pending`, no completed `aptitude_attempts` | learner/parent |
| `review` | enrolment `pending`, test completed | **admin** |
| `payment` | enrolment `accepted`, registration invoice balance > 0, no open submission | parent |
| `proof` | open submission in `awaiting_proof` | parent |
| `verification` | open submission in `submitted` | admin |
| `needs_placement` | enrolment `active`, but at least one subject could not be placed automatically (§4.7) | admin |
| `active` | enrolment `active`, every subject placed | — |
| `declined` | enrolment `declined` | — |

The parent portal card, the journey header, and the admin queue filters all read this view.

### 4.6 Admin learners: list → detail

**`/admin/learners`**, replacing the stack of summary cards (`learners/page.tsx`):
- `DataTable` (cards on mobile): **Name** (link) · Student ID · Grade · Stage/Status badge · Payment
  (Paid / Awaiting proof / To verify / Overdue) · Joined.
- Search (name, Student ID, guardian name), filters (status, grade, stage), server-side pagination
  (25/page). `GET /learners?search=&status=&grade=&stage=&page=`.

**`/admin/learners/[id]`**: tabs (on mobile, a select menu):
| Tab | Content |
|---|---|
| Overview | Name, Student ID, DOB/age, grade, school, home language, status, login status ("Has logged in" / "Password not set yet" + **Reset password**) |
| Family & safety | Guardians (billing contact marked), emergency contacts, authorised collectors |
| Enrolment | Package, subjects + medium, preferred vs assigned tutor, classes, stage. **Change class** per subject and **Change tutor** (§4.7) |
| Documents | Report cards with year/term. **Download** → `GET /learners/:id/documents/:docId/download` → 60 s signed URL. Upload replacement. |
| Aptitude | Result card (band, label, sub-scores, tutor note, confidence flag), item breakdown, **Allow retake** |
| Billing | Invoices, payments, proof submissions (links to §3.2 review) |
| Edit | Existing `LearnerEditor` (unchanged) |

Document downloads are written to an access log (`document_access_log`: who, what, when) for POPIA
accountability. It is cheap to add now and hard to add later.

### 4.7 Automatic placement (D12)

Placement is automatic and the admin can change it. When `verify_payment_submission` activates the
enrolment, it calls `auto_place_enrolment(p_enrolment_id)` in the same transaction. For each subject on
the enrolment:

1. **Candidates**: active `class_groups` in the current term with that `subject_code`, the medium the
   parent chose (`enrolment_subjects.preferred_language_code`; any medium if none), a
   `class_group_grades` row for the learner's grade, and at least one free seat (`capacity` minus open
   `class_enrolments`).
2. **No clashes**: drop any candidate whose `class_schedules` overlap a class already chosen for this
   learner in this run, or one they are already in.
3. **Rank**: the preferred tutor's class first, then the class with the most free seats, then the
   oldest.
4. **Place**: insert `class_enrolments` with `placement_method = 'auto'`. Candidate class rows are locked
   (`for update`) so two verifications at once cannot both take the last seat. The existing capacity
   trigger is the backstop.

**Assigned tutor**: the preferred tutor if they got at least one of the learner's classes, otherwise the
tutor of the first placed class.

**No class found**: the subject is left unplaced. The learner is still activated (they have paid), the
stage becomes `needs_placement`, admins are notified, and the parent sees "We're finalising Thandi's
Physical Sciences class".

**Admin changes**: on the learner detail page's Enrolment tab, each subject has **Change class** (lists
every suitable class with seats free and marks clashes) and the enrolment has **Change tutor**.
Changing a class closes the old row (`left_on = today`) and opens a new one with
`placement_method = 'admin'` and `placed_by`. That is the close-not-delete approach `withdrawPlacement`
already uses, so attendance history stays. The parent and the affected tutors are notified.

```sql
alter table public.class_enrolments
  add column placement_method text not null default 'admin'
    check (placement_method in ('auto', 'admin')),
  add column placed_by uuid references public.profiles (id);   -- null for 'auto'
```

---

## 5. Pre-paid billing with pro-rata first month (item 5)

### 5.1 Rule
When the admin **accepts** the application (§4.4) the system raises the **registration invoice**, due
immediately, with:

1. `registration` line: the registration fee (`package_price_on('registration', today)`, R150 today).
   Charged once per learner, as now.
2. `package` line: tuition for the **rest of the current month, counted from the acceptance date, that day
   included** (decided, D13: the parent does not pay for days spent waiting for review):
   `prorata = round(monthly_price × days_remaining / days_in_month)` where
   `days_remaining = days_in_month − day_of_month + 1`. The line carries `enrolment_id` and
   `period_month = date_trunc('month', today)`. That is exactly what `run_monthly_invoices` checks
   (`billing_run.sql:91`), so the normal run **automatically skips** this month and there is no
   double-billing.

Worked example: application accepted on **21 Nov 2026**, package R450/month. November has 30 days, so
10 remain (21–30). Tuition = 450 × 10/30 = **R150.00**. Due on acceptance = R150 + R150 = **R300.00**.

### 5.2 Implementation
- New function `private.prorata_cents(p_monthly_cents int, p_on date) returns int` is the single place
  that rounds. Rounding: **nearest whole rand** (decided, D8), so parents type a clean amount into PayShap.
- `submit_enrolment` raises **no** invoice. It returns `{enrolment_id, learner_id}`.
- New `accept_enrolment` creates the billing account if needed and raises the invoice (moved out of
  `activate_enrolment`). It returns `{invoice_id, amount_due_cents}`.
- `activate_enrolment` stops raising invoices and **refuses** to activate unless the enrolment is
  `accepted` and the registration invoice is settled (pre-paid rule). It is now called by
  `verify_payment_submission` rather than by an admin (D12). The `p_first_month_cents` / `first_month_*` columns are retired.
  Keep the columns for history, stop writing them, and remove the parameter in a later migration.
  Admin discretion is now a **credit note** against the invoice (existing `credit_notes`).
- The enrol review step (an estimate), the admin accept dialog and the payment dialog all call
  `GET /enrolments/quote?package=&on=`, which uses the same SQL function, so the accepted amount is always
  the number on the invoice.

### 5.3 Edge cases that must be handled

| Case | Rule |
|---|---|
| Paid **after the 15th** (the month-ahead run for next month has already happened) | Decided (D9). The first invoice still covers only the rest of the current month. On **payment verification**, if next month has no tuition line and that month's run date (`issue_day`, the 15th) has passed, `verify_payment_submission` raises **next month's tuition invoice** straight away, due on the 1st. Example: accepted on 20 Nov at R450. First payment R150 + R165 (20–30 Nov, 11 of 30 days) = **R315**, then a separate **R450** December invoice due 1 Dec. The check uses the verification date, not the acceptance date, so it also covers a family accepted on the 10th who pays on the 17th. |
| Accepted in Nov, parent pays in Dec | If the registration invoice is unpaid when a new month starts, the payment dialog **re-quotes**: cancel the old invoice (`status = 'cancelled'`) and issue a fresh one for the new month. Old proofs attached to it are withdrawn with a note. |
| Accepted but never paid | The acceptance **lapses** after **7 days** (D14). Reminder on day 3, then the enrolment returns to `declined` with reason "Offer lapsed" and the invoice is cancelled. Admin can re-accept. |
| Accepted on the last day | 1 day of tuition (R15 at R450). Valid, no special case. |
| Declined | Happens before any invoice exists, so there is nothing to refund. |
| Paid, but auto-placement finds no class for a subject | The learner is still activated and shows as `needs_placement` (§4.7). Admin places them by hand. If the centre really has no class, admin issues a credit note and refunds manually. |
| Learner re-enrols later | No registration line (existing once-per-learner check), pro-rata tuition only. |

`SPEC-2026-centre-rebuild.md` §9 rules 6 and 6b must be updated to point here.

### 5.4 Offer expiry (D14)

- `enrolments.offer_expires_at` is derived as `accepted_at + interval '7 days'` in `v_enrolment_progress`
  and not stored. The payment dialog and the acceptance message both show it: "Please pay by Fri 28 Nov".
- A daily job (Vercel Cron → `POST /internal/jobs/enrolment-offers`, protected by a cron secret) calls the
  SP `process_enrolment_offers(p_on date)`. The SP is idempotent, so a missed or repeated run is safe:
  - **Day 3** after acceptance: if the registration invoice is unpaid and no proof is under review, send a
    reminder (email + in-app). Record it in `enrolment_offer_events (enrolment_id, kind, sent_at)` so it is
    sent once.
  - **Day 7**: if still unpaid, set status `declined` with `decline_reason = 'Offer lapsed'`, cancel the
    registration invoice, withdraw any `awaiting_proof` submission, and notify the parent and admin.
- **A proof waiting for verification stops the clock.** If a submission is `submitted` when day 7 arrives,
  the offer does not lapse. If the admin then rejects that proof, the parent gets 2 more days to upload a
  new one.
- An admin can **re-accept** a lapsed application from the Declined tab. That issues a fresh invoice
  quoted from the new acceptance date and starts a new 7 days.

---

## 6. Student ID and learner login (item 6)

### 6.1 Format and issue
- `learners.student_number text unique`, format **`SK26-0042`** (`SK` + 2-digit year + 4-digit sequence,
  resetting yearly). Allocated under a row lock in `student_number_sequences`, the same pattern as
  `invoice_sequences`. Login accepts it with or without the hyphen, case-insensitive.
- Issued inside `verify_payment_submission` when the verified invoice is the learner's registration
  invoice. "Successfully registered" = registration paid and verified. Never reissued or reused.

### 6.2 Login account

> **Decided (D10):** every learner gets a Student ID. A login is created **by default for Grade 4 and up**.
> For Grade R–3 the login is **off by default**: the parent can turn it on at the verified step or later
> from the parent portal. For Grade 4+, the parent can turn it off. The default is based on the grade at
> verification. When a learner moves to Grade 4 the default does not change on its own; the parent portal
> shows a "Create Thandi's login" prompt instead.

- Supabase Auth needs an email, so the API creates the learner's auth user with a **synthetic,
  non-deliverable email** `sk26-0042@learners.skolopals.co.za` (a subdomain the centre controls, with no MX
  record), `email_confirm: true` so no mail is sent, role `learner`, and links `learners.profile_id`.
- This runs **after** the DB transaction commits (Auth is outside Postgres), so it is idempotent and
  retriable. `learners.login_status` is derived: no profile → "Login pending"; admin sees **Retry**.
- **Password**: the **parent sets it** in the verified screen of the payment dialog ("Choose a password
  for Thandi"; for Grade R–3 this screen shows "Create a login for Thandi?" with the toggle off), and can
  reset it any time from the parent portal. No generated password is ever shown or
  stored. Admin can also trigger a reset that the parent completes.
- Login form (client): the label becomes "Email or Student ID". The server action maps a Student ID
  pattern to the synthetic email before `signInWithPassword`. The same error message is used for unknown
  ID and wrong password. Rate limit 5 attempts / 15 min per ID (Redis guard pattern from `ThrottleGuard`).
- A learner role lands on `/learner` (portal already exists). Learners cannot change their own name, see
  billing, or see other children.
- The Student ID is shown on the parent's learner page, the admin learner list and detail, statements,
  and as a printable "login card" (ID + login URL, no password).

---

## 7. Dark purple + yellow theme (item 7)

### 7.1 Principle
Use colours **already in the logo** (`skolo-spinner-ring`: magenta `#d81b7a`, purple `#6a1b9a`, blue
`#1199db`, yellow `#f5c211`). The new background is a darker shade of the existing brand purple
`#6a1b9a`, not a new hue. Navy `#1b2559` stays for text on light surfaces.

### 7.2 Tokens (`packages/ui/src/styles/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--color-plum-950` | `#1e0b2e` | App canvas (universal background), public site sections |
| `--color-plum-900` | `#2a1040` | AppShell sidebar/top bar, footer |
| `--color-plum-800` | `#3a1658` | Raised areas on dark: nav hover, hero panels |
| `--color-plum-700` | `#4e1d76` | Borders on dark, active nav |
| `--color-purple` | `#6a1b9a` | Existing brand purple: links on dark, secondary buttons |
| `--color-sun` | `#f5c211` | **Yellow accent**: active nav indicator, stepper current step, key highlights ("R300 due today"), focus ring on dark, primary CTA on dark backgrounds (with plum-950 text) |
| `--color-sun-soft` | `#fdf4d7` | Existing cream: notices and promo banners on light cards |
| `--color-brand` | `#d81b7a` | Unchanged magenta: primary CTA on light surfaces |
| `--color-on-dark` | `#f6f1fa` | Body text on plum |
| `--color-on-dark-muted` | `#c9b8d9` | Secondary text on plum |

**Layout rule:** the canvas and chrome go plum. **Content cards, forms and tables stay light**
(`white` / `canvas #faf8f5`) on top of it. Long forms, the aptitude test and data tables must stay
easy to read, and the light card on dark plum gives the strong branded look without dark-mode-style
forms everywhere. Yellow is an **accent**, never a large fill except CTAs and small badges.

### 7.3 Contrast (must pass WCAG AA; verify with a script in CI)
- `#f6f1fa` on `#1e0b2e` ≈ 16:1 ✓ · `#c9b8d9` on `#1e0b2e` ≈ 10:1 ✓
- `#f5c211` on `#1e0b2e` ≈ 11:1 ✓ (yellow text and outlines on plum are safe)
- `#1e0b2e` on `#f5c211` ✓ (yellow buttons use **dark** text, never white)
- **Never** yellow text on white (≈ 1.7:1 ✗). Magenta `#d81b7a` text on plum-950 ≈ 3.8:1: use it only for
  large display text ≥ 24 px bold, not body copy.

### 7.4 Rollout
1. Add tokens; map semantic aliases (`--color-night` → plum-900, `body` background → plum-950).
2. Update `AppShell`, `PublicNav`/footer, `Stepper`, `Badge` tones, `Button` (`variant="sun"`).
3. Public pages: hero and process sections on plum with yellow accents. Keep the existing pastel
   process cards as light cards.
4. Update `docs/skolopals_ui_redesign_implementation_spec.md` to the new palette.
5. Screenshot review at 390 px and 1280 px for every page in the smoke list before merge.

---

## 8. API surface (new and changed)

| Method & path | Role | Purpose |
|---|---|---|
| `POST /tutors/onboard` | admin | Step 1: invite-or-attach person, create onboarding tutor |
| `PATCH /tutors/:id` | admin | Profile fields |
| `GET /tutors/:id/checklist` | admin | Activation checklist |
| `PATCH /tutors/:id/status` | admin | Activate/suspend (checklist enforced) |
| `POST /uploads/sign` | auth | `{purpose: report_card\|payment_proof\|tutor_document, …}` → signed upload URL + path |
| `GET /enrolments/quote` | parent | Amount due today for a package |
| `POST /enrolments` (changed) | parent | Requires `reportCard {stagingPath, year, term}`. Returns enrolment + learner ids, no invoice |
| `GET /enrolments/:id/progress` | parent/admin | Row from `v_enrolment_progress` |
| `GET /admin/applications?stage=` | admin | Applications queue (review / payment / placement / declined) |
| `GET /enrolments/:id/review` | admin | Everything for the review page: details, report card link, aptitude result, capacity hint |
| `POST /enrolments/:id/accept` | admin | Accept, raise registration invoice, notify parent |
| `POST /enrolments/:id/decline` (changed) | admin | Now requires `reason`, optional parent message |
| `PUT /enrolments/:id/report-card` | parent | Replace report card while stage = review |
| `POST /enrolments/:id/activate` (changed) | admin | Normally run by payment verification (D12). Kept for admin retry. Requires `accepted` + settled registration invoice |
| `PUT /enrolments/:id/subjects/:code/placement` | admin | Change the class for one subject (§4.7) |
| `PATCH /enrolments/:id/assigned-tutor` | admin | Change the assigned tutor |
| `POST /internal/jobs/enrolment-offers` | cron | Day-3 reminders and day-7 lapses (§5.4) |
| `POST /aptitude/attempts` | parent | Start (or resume) attempt for enrolment |
| `GET /aptitude/attempts/:id/next` | parent | Next item (no answer key) or `{done:true}` |
| `POST /aptitude/attempts/:id/answers` | parent | `{itemId, optionId, msTaken}` |
| `GET /aptitude/attempts/:id/result` | admin/tutor/guardian | Full result for admin; no item breakdown for tutors; summary for the guardian once decided (§4.3) |
| `POST /aptitude/attempts/:id/retake` | admin | Abandon and allow a new attempt |
| `GET /payment-settings/current` | parent | ShapID, account name |
| `PUT /payment-settings` | admin | Change ShapID (new effective-dated row) |
| `POST /invoices/:id/payment-submissions` | parent | "I have made the payment" |
| `POST /payment-submissions/:id/proof` | parent | Attach uploaded proof + claimed details |
| `GET /admin/payment-submissions?status=` | admin | Queue |
| `GET /payment-submissions/:id` | admin/owner | Detail + proof signed URL |
| `POST /payment-submissions/:id/verify` | admin | Record payment, settle, issue Student ID, activate, auto-place, bill next month if due |
| `POST /payment-submissions/:id/reject` | admin | With reason |
| `GET /learners` (changed) | admin | Paginated, searchable list |
| `GET /learners/:id/documents/:docId/download` | admin/tutor/guardian | Signed URL, access-logged, rules in §4.2 |
| `POST /learners/:id/login` | parent/admin | Create or reset learner login, parent sets password |
| `POST /auth/login` (changed) | public | Accept Student ID |

---

## 9. Delivery phases

Each phase is shippable on its own and passes `pnpm build lint typecheck test` plus db tests and smoke.

| Phase | Contents | Depends on |
|---|---|---|
| **A. Foundations** | Theme tokens (§7.2), `Stepper`, `Dialog`, `FieldRow`, responsive `AppShell` + `DataTable` (§2.2), generic `FileStorageService`, `POST /uploads/sign`, HEIC → JPEG conversion | — |
| **B. Pre-paid billing** | `prorata_cents`, invoice at acceptance (`accept_enrolment`), `accepted` status, `activate_enrolment` changes, quote endpoint, after-the-15th rule, rule-6 retirement, tests with fixed dates (1st, 15th, 16th, 28 Feb, 29 Feb 2028, 31st) | A |
| **C. Enrolment wizard + report card** | Wizard, staging upload, `learner_documents`, `v_enrolment_progress`, portal "Continue" card | A, B |
| **D. Aptitude test + application review** | Bank tables + seed generator + validation, attempt SPs, `AptitudeManager` with unit tests (including a simulated always-right / always-wrong / alternating learner), test UI; Applications queue, review page, accept / decline / request info, offer-lapse job | B, C |
| **E. PayShap payments + activation** | `payment_settings`, `payment_submissions`, bucket, parent dialog, admin queue + review, notifications; automatic activation, `auto_place_enrolment` and next-month invoice on verification | D |
| **F. Student ID + login** | Sequence, issue on verify, auth provisioning + retry, parent set-password, login by ID, rate limit | E |
| **G. Admin learners list/detail** | List with filters, detail tabs, document download + access log, aptitude tab, Change class / Change tutor; tutor and guardian access to report cards and results | C, D, E |
| **H. Tutor wizard** | `onboarding` status, wizard steps, checklist SP, vetting UIs | A |
| **I. Responsive sweep + theme rollout** | Page-by-page pass (§2.3, §7.4), mobile Playwright viewports, contrast check in CI | A–H |

H is independent and can run in parallel with B–G.

---

## 10. Acceptance criteria (summary)

- [ ] An admin can add a tutor who has never visited the website. The tutor receives an invite and
      cannot be timetabled until the checklist is complete.
- [ ] Every page in both apps has no horizontal scroll at 360 px. Nav is a drawer on mobile. Tables
      render as cards.
- [ ] No invoice exists and the payment dialog cannot be opened until an admin accepts the
      application. Accept is refused without a completed aptitude test and a report card.
- [ ] Declining requires a reason and notifies the parent. A declined application never has an invoice.
- [ ] An unpaid acceptance sends one reminder on day 3 and lapses on day 7 (invoice cancelled, parent
      notified), unless a proof is waiting for verification. Re-accepting starts a fresh 7 days.
- [ ] The whole application, including the test, can be completed on a 768 px tablet in portrait.
- [ ] An application with the R450 package accepted on 21 Nov asks the parent for exactly **R300**, and
      the 15 Dec run does **not** bill November again.
- [ ] Accepted on 20 Nov and paid the same day: the first payment is **R315**, and a **R450** December
      invoice due 1 Dec is raised on verification.
- [ ] Verifying a registration payment activates the enrolment and places the learner in a suitable
      class per subject, with no clashes and no over-capacity. Unplaceable subjects show as
      `needs_placement`. Admin can change any class or the tutor without losing attendance history.
- [ ] The guardian sees the aptitude level and sub-scores only after the accept/decline decision, and
      never the per-item breakdown.
- [ ] Enrolment cannot be submitted without a report card. Admin, the learner's tutors and the guardian
      can download it; nobody else can; every download is logged. An iPhone HEIC photo uploads and
      previews as a JPEG.
- [ ] The aptitude test serves 25 items (12 literacy in passage blocks, 13 logic), never repeats an item
      or passage, never sends an answer key to the browser, survives a page refresh mid-test, and records
      band, level and sub-scores.
- [ ] The payment dialog always shows "Step n of 4", resumes at the right step after closing, and
      displays the ShapID, exact amount and invoice-number reference with copy buttons.
- [ ] Admin sees the uploaded proof inline. Verifying records a `payshap` payment, settles the invoice,
      and cannot be done twice. Rejecting needs a reason and notifies the parent.
- [ ] On verification every learner gets a unique `SKyy-nnnn` Student ID. The login toggle defaults to
      on for Grade 4+ and off for Grade R–3. After the parent sets a password the learner can log in with
      the ID and lands on `/learner`.
- [ ] New colours pass the WCAG AA contrast check. Yellow text never appears on white.

---

## 11. Decisions

### 11.1 Decided (2026-11-21)

| # | Decision |
|---|---|
| D2 | **PayShap** (South Africa's instant payment system). The ShapID and account name are entered in `payment_settings` before go-live. |
| D4 | The learner must be **accepted** before any payment can be made. The aptitude test (and report card) inform the accept/decline decision (§4.4). |
| D10 | Student ID for everyone. Login on by default from Grade 4, off by default for Grade R–3, and the parent can change it either way (§6.2). |
| D13 | Pro-rata tuition is counted from the **acceptance** date, that day included (§5.1). |
| D14 | An unpaid acceptance **lapses after 7 days**, with a reminder on **day 3** (§5.3, §5.4). |
| D15 | No accepting without the online test in v1. **All applications are made on an electronic device.** Walk-ins use a centre tablet (§4.4). |
| D1 | Police clearance **not required** to activate a tutor for now. Shown as optional on the checklist (§1.3). |
| D3 | A report card is **required**, with no exceptions (§4.1, §4.2). |
| D5 | The learner's tutors can view and download the report card (§4.2). |
| D6 | Guardians see the aptitude level and sub-scores, after the review decision (§4.3). |
| D7 | iPhone (HEIC) photos are accepted and converted to JPEG (§0.2 rule 6). |
| D8 | Pro-rata rounds to the nearest rand (§5.2). |
| D9 | Paid after the 15th: first payment covers the rest of this month, and next month's invoice is raised at once, due on the 1st (§5.3). |
| D11 | **No turnaround times are shown to parents**, for either application review or payment verification. Copy says "We'll let you know" instead (§3.1, §4.1). Admin queues still show each item's age so nothing sits unnoticed. |
| D12 | Placement is automatic on payment verification, and the admin can change it (§4.7). |

### 11.2 Still open

None. The spec is ready to build.

---

## 12. Progress

Legend: `[x]` done and verified · `[~]` in progress · `[ ]` not started. Update in the same change as the work.

### Phase A — Foundations (code complete 2026-11-21; visual check pending)
- [x] A1 Theme tokens added to `globals.css` (plum scale, sun, on-dark). Tokens only: the visual switch is Phase I
- [x] A2 Form legibility: inputs 16 px / 44 px tall on mobile (no iOS zoom), labels and field errors 12 px
- [x] A3 `Stepper` component (`@skolopals/ui/stepper`): all steps labelled ≥ md, "Step n of m" + progress bar < md, completed steps revisitable
- [x] A4 `Dialog` component (`@skolopals/ui/dialog`): native `<dialog>`, centred ≥ sm, full-screen sheet < sm, pinned header/footer, scroll lock, `dismissible={false}` for flows
- [x] A5 `FieldRow` layout helper (`@skolopals/ui/ui`)
- [x] A6 Responsive `AppShell`: phone top bar with current section + drawer (`mobile-nav.tsx`); icon rail md–lg; full sidebar ≥ lg; 44 px nav targets
- [x] A7 Responsive `DataTable`: rows become cards < md (CSS only, one DOM so cells with forms never duplicate); optional `rowHref` makes a card tappable
- [x] A8 Generic `FileStorageService`: bucket per call, `STORAGE_BUCKETS` registry, adds `download` / `upload` / `move`; tutors migrated
- [x] A9 Migration `20261121000001_learner_and_payment_buckets.sql`: `learner-documents`, `payment-proofs` (private, 10 MB, PDF/JPEG/PNG/HEIC/HEIF, admin read only). Verified on a fresh DB: 37 migrations apply, all db suites and `deploy-check` pass
- [x] A10 `POST /uploads/sign` + `POST /uploads/confirm`: staging folder per user, type judged from bytes, size re-checked, bad files deleted, path-escape refused. Purposes: `report_card`, `payment_proof`
- [x] A11 HEIC → JPEG on confirm (`heic-convert`). Verified against a real HEIC file
- [~] A12 Phase gate. Done: API lint, typecheck, 433 tests, build; UI lint and typecheck; admin and client production builds. **Still to do:** look at the new shell, drawer, tables and dialog in a browser at 390 px and 1280 px

**Notes for later phases**
- Staging uploads need a cleanup job (delete `staging/*` older than 24 h). It belongs with the first consumer (Phase C).
- Large iPhone photos (12 MP) take longer to convert than the test image. Watch the confirm endpoint's duration once real uploads arrive.
- The local dev database `skolopals_dev` is out of step with its migration ledger (`20261110000001` is not recorded, but its policy exists). Not caused by this work. `make reset` rebuilds it, but that wipes local data.

### Phase B — Pre-paid billing
- [ ] Not started

### Phase C — Enrolment wizard + report card
- [ ] Not started

### Phase D — Aptitude test + application review
- [ ] Not started

### Phase E — PayShap payments + activation
- [ ] Not started

### Phase F — Student ID + login
- [ ] Not started

### Phase G — Admin learners list/detail
- [ ] Not started

### Phase H — Tutor wizard
- [ ] Not started

### Phase I — Responsive sweep + theme rollout
- [ ] Not started
