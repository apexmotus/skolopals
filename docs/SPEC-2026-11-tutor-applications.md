# Tutor applications — Spec

**Status:** Built 2026-11-26, not yet deployed · **Date:** 2026-11-26

How a person applies to teach at the centre: the administrator switches applications on, the landing page invites tutors to apply, a signed-in applicant completes a step-by-step form, and an administrator reviews it. Approving an application turns the applicant's account into a tutor and copies everything they submitted into the vetting records.

---

## 1. Decisions (brainstorm 2026-11-26)

| Topic | Decision |
| :--- | :--- |
| Opening and closing | **An on/off switch the admin can flip at any time.** Switching on opens a *recruitment round*; switching off closes it. Optional extras: a closing date (closes it automatically) and the subjects the centre is short of |
| Who can apply | **Signed-in users only.** A visitor without an account signs up first (an ordinary account), then lands back on the form. This reuses the existing upload pipeline unchanged |
| Subjects | **Subject + grade + language of instruction**, the same shape as `tutor_competencies`, so approval needs no re-entry |
| Approval | **Auto-provision.** Approving grants the tutor role, creates the `tutors` row and copies competencies, documents and references into the vetting tables. The tutor starts **suspended** and the admin activates them once vetting is done |
| Form style | The same wizard pattern as `/enrol`: one `<form>`, one visible `data-step` section at a time, `Stepper` at the top, each step checked before Next |
| Identity | **Every applicant uploads a photo of their ID and takes a selfie.** The admin compares the two by eye; there is no automated face matching |
| Police clearance | **The admin chooses per round** whether applicants must upload a police clearance certificate. When it isn't required, the step doesn't ask for it, and the admin can still request it from an individual applicant during review (section 4.4) |

### 1.1 Business rule change (BRS)

BR-23 currently reads *"Only an administrator shall create a tutor. No public tutor application"*, and the BRS lists "Become a Tutor page + application" as **Withdrawn**. This feature needs it amended:

| Rule | New wording |
| :--- | :--- |
| BR-23 | Only an administrator shall create a tutor. **The public may apply while the centre has applications open; an application creates nothing until an administrator approves it.** |
| BR-23a (new) | The administrator shall be able to open and close tutor applications at any time, optionally with a closing date and a list of subjects needed |
| BR-23b (new) | A tutor created from an application shall start suspended and become active only when an administrator activates them |

The `tutors.profile_id` column comment ("There is no public tutor application") is updated in the same migration.

---

## 2. The admin switch

### 2.1 Where

**Admin portal → new "Tutor applications" page** (`apps/admin/src/app/admin/tutor-applications/`), in the nav next to Tutors.

At the top is a **Recruitment** card:

| State | Shows | Actions |
| :--- | :--- | :--- |
| Closed | "Applications are closed. Last round: 3 Nov – 20 Nov, 14 applications" | **Open applications** → dialog: closing date (optional), subjects needed (optional multi-select), short message for applicants (optional), **"Require a police clearance certificate" switch** (off by default) |
| Open | "Open since 26 Nov · closes 15 Dec · 6 applications so far · Police clearance required" | **Close now**, **Edit** (closing date, subjects needed, message, police clearance switch) |

Below it is the list of applications (section 5).

### 2.2 Rules

- At most one round is open at a time (unique partial index).
- A round counts as **open** when `closed_at is null and (closes_at is null or closes_at > now())`. A closing date in the past therefore closes the round without a scheduled job. The admin page shows it as closed, and **Open applications** starts a new round.
- **Close now** sets `closed_at`. Reopening always creates a **new** round, so each application stays tied to the round it was submitted in, and the history shows when the centre was recruiting.
- Only admins and superadmins can switch it.
- Changing the police clearance switch on an open round affects **only applications submitted afterwards**. Each application records whether it was required (`police_clearance_required`), so the admin page never shows an earlier applicant as missing a document they weren't asked for.

### 2.3 How fast the public site reacts

Public reads are cached per app (`packages/shared/src/api/client.ts`, `catalogue` = 300 s), and the admin app can't revalidate the client app's cache. Fix: add a `live` freshness tier of **60 s** and use it for the recruitment status. The landing button appears or disappears within a minute. The form itself never trusts the cache: the page re-reads the status uncached for the signed-in user, and submission is refused server-side once the round is closed.

---

## 3. Public side

### 3.1 Landing page (`apps/client/src/app/(public)/page.tsx`)

Only while a round is open:

- **Hero:** a third button after "See our fees": **Apply to teach** (outline style, like "See our fees"), linking to `/teach`.
- **New banner section** above "Our tutors": *"We're looking for tutors"*, the admin's message, and the subjects needed as chips if any were set, with the closing date: "Applications close 15 Dec". The button is **Apply to teach**.

When closed, neither appears. Nothing on the page hints at tutor applications.

### 3.2 `/teach` — one page, several states

`apps/client/src/app/(public)/teach/page.tsx` (`/tutor` is already the tutor portal):

| Visitor | Shows |
| :--- | :--- |
| Applications closed | "We're not taking tutor applications right now." Back to home |
| Signed out | What we look for, what you'll need (CV, a qualification, your ID, a phone camera for a selfie, three references, and a police clearance certificate when the round requires one), **Create an account** (`/signup?next=/teach`) and **I already have one** (`/login?next=/teach`) |
| Already a tutor or admin | "You already work with us." Link to their portal |
| Signed in, already applied this round | Their application's status card (section 4.3). **Withdraw** while it's still `submitted` |
| Signed in, can apply | The wizard |

> Check during build: `/signup` must carry `next` through email confirmation (the login action already honours it). If it doesn't, add it. Most applicants will be new.

### 3.3 The wizard (`teach/apply-form.tsx`)

| # | Step | Fields | Checked before Next |
| :--- | :--- | :--- | :--- |
| 1 | About you | First name, last name (pre-filled from the profile), email (read-only, from the account), phone number, **"My WhatsApp number is the same" switch** (on by default), WhatsApp number (shown only when the switch is off) | Required fields; SA phone format (`0XXXXXXXXX` or `+27…`), normalised to `+27` on the server |
| 2 | Address | Address line 1, Address line 2 (optional), Town/City, Province, Country | Country defaults to **South Africa**. While it's South Africa, Province is a select of the nine provinces; otherwise a free-text "Province / region" |
| 3 | Subjects | Rows of **subject → grades (checkboxes, only grades the centre offers that subject in) → languages of instruction**. "Add another subject" adds a row. Subjects the centre needs are listed first and marked **Needed** | At least one row; every row has at least one grade and one language |
| 4 | Documents | **CV / resume** (required, one file). **Qualification** (required, at least one; "Add another" up to 3) with title, institution, year | Each upload confirmed (`UploadField`); title filled in for each qualification |
| 5 | Identity | **Photo of your ID** (required): front of the smart ID card or the photo page of the green ID book or passport; **back of the smart ID card** (optional upload). **Selfie** (required): opens the front camera on phones, with guidance ("Face the camera, good light, no hat or sunglasses"). **Police clearance certificate**: shown only when the round requires it, PDF or photo | ID front and selfie uploaded; police clearance uploaded when required |
| 6 | References | **Exactly three** references: full name, relationship ("Former principal"), phone, email (optional) | All three complete; no two with the same phone number |
| 7 | Review & submit | Read-only summary of steps 1–6 with "Edit" links (the `Stepper`'s `onSelect`); ID and selfie appear as thumbnails. Checkboxes: *"I agree that Skolopals may process my information, including my ID and photo, to assess my application and confirm who I am"* (POPIA); *"My references have agreed to be contacted"*; *"The information I've given is true"* | All three ticked |

As in `/enrol`, every step lives in one form, so values survive going back and forth. If the round closes while someone is filling in the form, submitting shows *"Applications closed while you were applying"*. Values stay on screen, and the staged files are left to the normal staging clean-up.

Grade checkboxes use the existing `subject_offerings` data (`getSubjects`/`getGrades` already load it for `/enrol`). Languages are limited to `isInstructionMedium` languages, as for enrolment.

### 3.4 Uploads

New purposes in `api/src/modules/uploads/upload-purposes.ts`:

```ts
tutor_cv:               { bucket: STORAGE_BUCKETS.tutorDocuments, roles: ['parent', 'learner'], maxBytes: TEN_MB },
tutor_qualification:    { bucket: STORAGE_BUCKETS.tutorDocuments, roles: ['parent', 'learner'], maxBytes: TEN_MB },
tutor_id_document:      { bucket: STORAGE_BUCKETS.tutorDocuments, roles: ['parent', 'learner'], maxBytes: TEN_MB },
tutor_selfie:           { bucket: STORAGE_BUCKETS.tutorDocuments, roles: ['parent', 'learner'], maxBytes: TEN_MB, imagesOnly: true },
tutor_police_clearance: { bucket: STORAGE_BUCKETS.tutorDocuments, roles: ['parent', 'learner', 'tutor'], maxBytes: TEN_MB },
```

- **`imagesOnly`** is a new optional flag. `confirm` already detects the type from the bytes, and with this flag it rejects a PDF ("A selfie must be a photo"). The client's `UploadField` gets a matching `accept="image/*"`.
- **`UploadField.capture`** becomes `"environment" | "user" | undefined` (today it's a boolean meaning the rear camera). The selfie passes `"user"` for the front camera. Phones without camera support fall back to picking a photo, which is accepted.
- **`tutor` on police clearance** covers a clearance requested after approval (section 4.4, last row).

Roles: every new account is a `parent` (`handle_new_user`), and existing tutors and admins can't apply. Files are staged at `staging/<uid>/` in the existing private `tutor-documents` bucket. On submit, the API moves them to `applications/<application_id>/<uuid>.<ext>`. On approval, `tutor_documents.storage_path` points at the same object, so nothing moves twice. The client `UploadPurpose` union and its `BUCKET` map gain the two entries.

### 3.5 Applicant status

| Status | Applicant sees |
| :--- | :--- |
| `submitted` | "Received on 27 Nov. We'll be in touch." **Withdraw** |
| `shortlisted` | "You've been shortlisted. We'll contact you to arrange an interview." |
| Police clearance requested (any open status) | A highlighted card: "We need your police clearance certificate", with the admin's message and an upload field (section 4.4) |
| `approved` | "Welcome to Skolopals." Explains that the account is now a tutor account; **Go to the tutor portal** after signing in again |
| `rejected` | "Thank you for applying. We won't be taking your application further this time." (The admin's note is internal and not shown) |
| `withdrawn` | "You withdrew this application." |

Each change also sends a portal notification (`private.notify`).

---

## 4. Admin review

### 4.1 List

Columns: name, subjects (summary, "Maths 4–7 · English 1–3"), submitted, round, status. Filters: status (default "Needs action" = submitted + shortlisted), round. Subjects the round needed are highlighted.

### 4.2 Detail page (`/admin/tutor-applications/[id]`)

- Personal details, phone and WhatsApp (a `wa.me` link), address.
- Competencies as a table (subject · grades · languages).
- **Identity panel:** the ID photo and the selfie side by side at the same height, with the name the applicant typed underneath, so the admin can compare face and name in one look. **Mark identity checked** records `identity_checked_by`/`_at`. Approve stays possible without it, but the confirmation dialog warns "Identity not checked yet".
- **Police clearance:** "Required for this round: uploaded 27 Nov", "Not required" with a **Request police clearance** button, "Requested 28 Nov, waiting", or "Received 2 Dec".
- Other documents, with signed download URLs (same as `GET /tutors/:id/documents`).
- The three references.
- Actions: **Shortlist**, **Approve**, **Reject** (optional internal note). Approve and Reject ask for confirmation. Approve is offered from `submitted` or `shortlisted`.

### 4.3 What Approve does (one transaction)

1. Re-checks that the applicant isn't already a tutor.
2. Adds the `tutor` role. Removes `parent`, and the empty `guardians` row, **only if** no learner is linked to them (same rule as `configure_invited_user`, now shared as `private.make_tutor(p_user_id, …)`, which both functions call).
3. Creates `tutors` with a slug from the name (same de-duplication), `employment_type = 'sessional'`, **`status = 'suspended'`** and `application_id`.
4. Copies the submitted name onto `profiles` and the phone onto `profiles.phone`.
5. Inserts `tutor_competencies` and `tutor_competency_media` from the application's rows. Rows whose offering no longer exists are skipped and listed back to the admin.
6. Inserts `tutor_documents` (`cv`, `qualification`, `id`, `selfie` and `police_clearance` if one was uploaded) and `tutor_qualifications` (type `other` unless the admin picks one later). The `id` and `selfie` rows are stamped verified when the identity check was done (section 4.2); the rest are unverified.
7. Inserts the three `tutor_references` with `outcome = null`.
8. Marks the application `approved`, stamps `reviewed_by`/`reviewed_at` and `tutor_id`, and notifies the applicant.

The admin lands on the new tutor's page (`/admin/tutors/[id]`) to set pay rate, spoken languages, ID and police clearance, check references, then **Activate**. Address and WhatsApp stay on the application, which the tutor page links to ("From application of 27 Nov").

Role changes take effect at the user's next sign-in (roles are read into the session at login). The approval notification says so.

### 4.4 Requesting a police clearance

SAPS clearance certificates take weeks to issue, which is why the default is to not require one up front. When the round didn't require one, the admin can still ask for it:

| When | Admin does | Applicant sees |
| :--- | :--- | :--- |
| `submitted` or `shortlisted` | **Request police clearance** with an optional message ("Please upload by 15 Jan") | A portal notification, and the upload card on `/teach` (section 3.5). Uploading clears the request and notifies admins |
| After approval | The existing **Documents** section on `/admin/tutors/[id]` gets a **Request police clearance** button doing the same for the tutor | A notification and an upload card on the tutor portal home page |

The request doesn't block anything by itself: the admin still decides when to approve or activate. The tutor page shows "Police clearance: requested, waiting" until it arrives.

---

## 5. Data changes (one migration)

`db/migrations/20261126000001_tutor_applications.sql`

```sql
create table public.tutor_recruitment_rounds (
  id          uuid primary key default gen_random_uuid(),
  opened_at   timestamptz not null default now(),
  opened_by   uuid not null references public.profiles (id),
  closes_at   timestamptz,                 -- optional automatic close
  closed_at   timestamptz,                 -- set by "Close now"
  closed_by   uuid references public.profiles (id),
  message     text not null default '',
  police_clearance_required boolean not null default false,
  check (closes_at is null or closes_at > opened_at)
);
create unique index on public.tutor_recruitment_rounds ((true)) where closed_at is null;

create table public.tutor_recruitment_needs (
  round_id     uuid not null references public.tutor_recruitment_rounds (id) on delete cascade,
  subject_code text not null references public.subjects (code),
  primary key (round_id, subject_code)
);

create table public.tutor_applications (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references public.tutor_recruitment_rounds (id),
  applicant_id     uuid not null references public.profiles (id) on delete cascade,
  first_name       text not null,
  last_name        text not null,
  phone            text not null,
  whatsapp_number  text not null,          -- copied from phone when the switch is on
  address_line_1   text not null,
  address_line_2   text not null default '',
  city             text not null,
  province         text not null,
  country          text not null default 'South Africa',
  status           text not null default 'submitted'
    check (status in ('submitted', 'shortlisted', 'approved', 'rejected', 'withdrawn')),
  decision_note    text not null default '',
  police_clearance_required     boolean not null,      -- copied from the round at submission
  police_clearance_requested_at timestamptz,           -- set by "Request police clearance"
  police_clearance_request_note text not null default '',
  identity_checked_by uuid references public.profiles (id),
  identity_checked_at timestamptz,
  popia_consent_at timestamptz not null,
  submitted_at     timestamptz not null default now(),
  reviewed_by      uuid references public.profiles (id),
  reviewed_at      timestamptz,
  tutor_id         uuid references public.tutors (id),
  unique (round_id, applicant_id)
);

create table public.tutor_application_competencies (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.tutor_applications (id) on delete cascade,
  subject_code   text not null,
  grade_code     text not null,
  unique (application_id, subject_code, grade_code),
  foreign key (subject_code, grade_code) references public.subject_offerings (subject_code, grade_code)
);

create table public.tutor_application_competency_media (
  competency_id uuid not null references public.tutor_application_competencies (id) on delete cascade,
  language_code text not null references public.languages (code),
  primary key (competency_id, language_code)
);

create table public.tutor_application_documents (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.tutor_applications (id) on delete cascade,
  doc_type       text not null
    check (doc_type in ('cv', 'qualification', 'id', 'id_back', 'selfie', 'police_clearance')),
  storage_path   text not null,
  original_name  text not null,
  mime_type      text not null,
  size_bytes     integer not null,
  title          text not null default '',  -- qualification title
  institution    text not null default '',
  year_awarded   smallint check (year_awarded between 1950 and 2100)
);

create table public.tutor_application_references (
  application_id uuid not null references public.tutor_applications (id) on delete cascade,
  position       smallint not null check (position between 1 and 3),
  full_name      text not null,
  relationship   text not null,
  phone          text not null,
  email          text not null default '',
  primary key (application_id, position)
);

alter table public.tutors add column application_id uuid references public.tutor_applications (id);
alter table public.tutors add column police_clearance_requested_at timestamptz;

-- Selfies (and the back of a smart ID card) are new kinds of vetting document.
alter table public.tutor_documents drop constraint tutor_documents_doc_type_check;
alter table public.tutor_documents add constraint tutor_documents_doc_type_check
  check (doc_type in ('id', 'id_back', 'selfie', 'qualification', 'police_clearance', 'cv', 'other'));
```

On submit, `private.submit_tutor_application` requires exactly one `id` and one `selfie`, at most one `id_back`, and a `police_clearance` when the round requires it. Any later upload is added through `private.add_police_clearance`.

**RLS:** all application tables are admin read/write. Applicants read **their own** `tutor_applications` row only (status card). They never write directly: submission and withdrawal go through functions.

**Functions** (storage paths are involved, so as in `20261125000003_payshap_payments.sql` the applicant-facing ones live in `private`, API only):

| Function | Who | Does |
| :--- | :--- | :--- |
| `public.tutor_recruitment_status()` | anon | `{ is_open, closes_at, message, needs[] }` for the landing page. No counts or names |
| `public.open_tutor_recruitment(p_closes_at, p_message, p_needs text[])` | admin | Closes any expired round, then opens a new one |
| `public.update_tutor_recruitment(...)` / `public.close_tutor_recruitment()` | admin | Edit / close the open round |
| `private.submit_tutor_application(p_applicant uuid, p_payload jsonb)` | API | Checks: round open; applicant not a tutor or admin; no live application this round; ≥1 competency each with ≥1 language; exactly 3 references; 1 CV; 1–3 qualifications; consents. Inserts everything and notifies admins (`private.admin_ids()`) |
| `private.withdraw_tutor_application(p_applicant, p_id)` | API | Only from `submitted` |
| `public.set_tutor_application_status(p_id, p_status, p_note)` | admin | `shortlisted` / `rejected`, notifying the applicant |
| `public.approve_tutor_application(p_id)` | admin | Section 4.3 |
| `public.mark_tutor_application_identity_checked(p_id)` | admin | Stamps the identity check |
| `public.request_police_clearance(p_application_id, p_tutor_id, p_note)` | admin | Exactly one of the two ids. Sets `police_clearance_requested_at` and notifies the person |
| `private.add_police_clearance(p_user uuid, p_storage_path, …)` | API | Adds the certificate to the caller's open application or tutor record, clears the request, notifies admins |
| `private.make_tutor(...)` | internal | Role swap + `tutors` row; `configure_invited_user` refactored to call it |

---

## 6. API (`api/src/modules/tutor-applications/`)

Controller → manager → repository, as in `tutors/`:

| Method | Path | Roles | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/tutor-applications/recruitment` | `@Public()` | Landing page, `live` freshness |
| POST | `/tutor-applications/recruitment` | admin | Open |
| PATCH | `/tutor-applications/recruitment` | admin | Edit open round |
| POST | `/tutor-applications/recruitment/close` | admin | Close now |
| POST | `/tutor-applications` | signed in | Submit. Moves staged files, then calls `private.submit_tutor_application`. `@Throttle(5, 60_000)` like enquiries |
| GET | `/tutor-applications/me` | signed in | Current round's application, if any |
| POST | `/tutor-applications/me/:id/withdraw` | signed in | |
| GET | `/tutor-applications` | admin | `?status=&roundId=` |
| GET | `/tutor-applications/:id` | admin | With signed document URLs |
| PATCH | `/tutor-applications/:id/status` | admin | Shortlist / reject |
| POST | `/tutor-applications/:id/approve` | admin | Returns `{ tutorId, skippedCompetencies[] }` |
| POST | `/tutor-applications/:id/identity-checked` | admin | |
| POST | `/tutor-applications/:id/request-police-clearance` | admin | `{ note? }` |
| POST | `/tutors/:id/request-police-clearance` | admin | Same, after approval |
| POST | `/tutor-applications/me/police-clearance` | signed in | `{ path }` of a confirmed `tutor_police_clearance` upload; works for an applicant or a tutor |

DTOs are validated with `class-validator`. Phone numbers are normalised to `+27…` in the manager. When the WhatsApp switch is on, the client sends only `phone` and the manager copies it.

---

## 7. Defaults chosen (change if you disagree)

| # | Default |
| :--- | :--- |
| D1 | Route `/teach`, button text **Apply to teach** |
| D2 | Landing status cached 60 s (new `live` tier); the form and submission always re-check uncached |
| D3 | A person may apply once per round; a rejected or withdrawn applicant can apply again in a later round |
| D4 | Up to 3 qualification files; CV is a single file; PDF, JPG, PNG or HEIC, 10 MB each (existing limits) |
| D5 | Reference email optional, phone required |
| D6 | Approved tutors start `suspended` and stay out of the public directory until activated |
| D7 | Rejection notes are internal; the applicant gets a standard message |
| D8 | POPIA retention: rejected and withdrawn applications, and their files, are deleted **12 months** after the decision. As with learner records, nothing is deleted silently: they appear under **Due for deletion** on the Tutor applications page and an admin confirms each one (`purge_tutor_application`, logged in `data_retention_log` without the applicant's name). Abandoned uploads go after 24 hours with the staging clean-up job. `POPIA-policy.md` A2, A3, A5, A6, A8, B4 and B5 updated |
| D9 | The form takes a **photo** of the ID but not the ID number typed in. The admin reads it off the photo if needed |
| D10 | Police clearance is **off by default** for a new round, because SAPS certificates take weeks and would put most applicants off |
| D11 | The ID and selfie are compared by a person, not software. That keeps it clear of POPIA's rules on biometric data (special personal information, s26), as long as no face-matching tool is added later |
| D12 | ID photos, selfies and clearances are shown only to admins, through short-lived signed URLs, as with all `tutor-documents` files. They're never shown on the public tutor profile, which keeps using `tutors.photo_url` |

---

## 8. Build order

1. Migration + `private.make_tutor` refactor + pgTAP/SQL checks for open/close and approve.
2. Upload purposes + API module + unit tests (manager specs as in `tutors.manager.spec.ts`).
3. Admin: Recruitment card + list + detail + approve/reject.
4. Client: `/teach` states + wizard + landing button/banner + signup `next`.
5. BRS amendment (BR-23, 23a, 23b), POPIA policy note (D8), `E2E-TEST-PLAN.md` cases: open → apply → shortlist → approve → activate; close mid-form; reapply after rejection; existing tutor visits `/teach`; round with police clearance required (step blocks without it); request clearance from an applicant and from an approved tutor, then upload it; a PDF uploaded as a selfie is refused; the selfie opens the front camera on a phone.

## 9. Manual impact

New sections: *Admin → Opening and closing tutor applications*, *Admin → Reviewing an application*, *Public → Applying to teach*. The existing *Adding a tutor* section stays: invite and promote remain available for tutors the centre recruits directly.
