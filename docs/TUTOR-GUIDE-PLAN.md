# Skolopals Tutor Guide — Plan

**Status:** Started 2026-11-27 · **Owner:** Mollo Mponya · **Deliverable:** branded PDF (`docs/manual/Skolopals-Tutor-Guide.pdf`)

A standalone guide to a tutor's journey, from the centre opening applications to the tutor confirming the register after an online lesson. It uses the same branding, build kit and capture helpers as the main user manual (`USER-MANUAL-PLAN.md`).

## 1. Decisions

| Topic | Decision |
| :--- | :--- |
| Structure | A separate Tutor guide PDF, not a new part of the main manual |
| Story | One new example tutor followed end to end: apply → reviewed → approved → activated → given an online class → teaches → confirms the register |
| Environment | UAT (`skolopals-web-uat`, `skolopals-admin-uat`). Never production |
| Applicant | A new Gmail plus-address account (`mollodagod+tutor…@gmail.com`) with a made-up name. Mollo clicks the confirmation email; Claude does the rest with SAMPLE fixture files |
| Admin | Lindiwe Khumalo (seed admin) |
| Online class | A new online class for the new tutor today, with the sample learner placed in it, so only sample accounts are notified |
| Screens | Phone for the applicant and the public pages; desktop for the admin; the tutor portal on desktop, as in the main manual |
| Tone and extras | As the main manual: plain, friendly English. FAQ, statuses, and the privacy summary for applicants |

## 2. The journey

```
Admin opens applications (closing date, subjects needed, police clearance on/off)
  → "Apply to teach" appears on the home page
  → Applicant signs up → confirms email → /teach
  → 7 steps: About you · Address · Subjects · CV & qualifications · Identity (ID + selfie) · References · Review
  → Status card on /teach (Submitted; can withdraw)
  → Admin reviews: documents, ID beside the selfie → Mark identity checked → Shortlist
  → (optional) Request police clearance → applicant uploads it from /teach
  → Approve → tutor record, suspended
  → Admin sets pay, checks references, activates
  → Tutor signs in again → tutor portal
  → Admin creates an online class with the tutor and places a learner
  → Lesson: the learner joins through /join; the tutor's register shows "Joined 15:32"
  → After the lesson the tutor checks the suggested marks and taps Confirm register
```

## 3. Phases

| Phase | Status |
| :--- | :--- |
| Interview | ✅ 2026-11-27 |
| Bug sweep (UAT) | ✅ Done while capturing |
| Capture | ✅ 2026-11-27 (online lesson 11:00–11:30; Thuli joined 10:48; register confirmed 11:31) |
| Write and build the PDF | ✅ v1.0: `docs/manual/Skolopals-Tutor-Guide.pdf` (43 pages, 4.5 MB) from `build_tutor_guide.py` |

## 4. Bugs

| # | Where | What | Cause / status |
| :--- | :--- | :--- | :--- |
| 1 | Admin → **Tutor applications** (UAT) | Page crashes: "Something went wrong on our side" (ref 4077116001) | UAT has an early, unrecorded draft of `20261126000001_tutor_applications` without the retention view (`relation "public.v_tutor_application_retention_due" does not exist`, API log 07:01:41). Same state dev was in. Repair: `db/scripts/repair-uat-ledger.sh <UAT 5432 URL>`, then `make migrate`. ✅ Mollo ran it 2026-11-27; page verified in UAT |
| 2 | Admin → **Tutors** → *Add a tutor* | Says "There is no public tutor application" | ✅ Fixed, awaiting deploy: now points to Tutor applications for recruiting (`apps/admin/src/app/admin/tutors/tutor-forms.tsx`) |
| 3 | `/teach` on a phone | Top bar says "Skolopals", not "Apply to teach" | ✅ Fixed, awaiting deploy: `/teach` added to the public nav's page titles (`components/public-nav.tsx`) |
| 4 | Public → **Work with us** | Says "We do not have an online application" | ✅ Fixed, awaiting deploy: explains *Apply to teach* on the home page while recruiting (`(info)/[page]/page.tsx`) |
| 5 | Admin → Tutor applications → recruitment card | After *Close now* then *Open applications*, the card says Open but still shows "Applications are closed…" | ✅ Fixed, awaiting deploy: the close message only shows while closed (`recruitment-forms.tsx`) |
| 6 | Admin → application → *Shortlist* / *Mark identity checked* | The button disappears on success and takes its confirmation ("The applicant has been told") with it, so the admin sees no confirmation | ✅ Fixed, awaiting deploy: the components stay mounted and show the message (`review-forms.tsx`, `[id]/page.tsx`) |
| 7 | Applicant → `/teach` after *Send certificate* | The upload card vanishes and nothing confirms the certificate arrived | ⬜ Open (small): add "Police clearance certificate received" to the status card |
| 8 | Admin → Timetable → *Add a class* mid-term | Sessions are generated for the whole term, including dates already past (a class created on 27 Nov got Fridays from 16 Oct), so a new tutor's register lists lessons that never happened | ⬜ Open, needs a migration: `generate_class_sessions` should start from `greatest(term start, today)`. Ask Mollo |

## 5. Records created or changed in UAT

| When | What | Notified |
| :--- | :--- | :--- |
| 2026-11-27 | Recruitment round opened by Lindiwe (closes 18 Dec; needs Mathematics, Physical Sciences), closed and reopened once to retake the dialog shot | Nobody |
| 2026-11-27 | Account `mollodagod+tutor@gmail.com` (Palesa Mokoena) signed up | Confirmation email to Mollo |
| 2026-11-27 | Palesa's application submitted (SAMPLE CV, qualification, ID, selfie; made-up references, 072 555 01xx) | All admins: "New tutor application" |
| 2026-11-27 | Lindiwe marked identity checked, shortlisted, requested police clearance | Palesa (shortlisted, clearance request) |
| 2026-11-27 | Palesa uploaded a SAMPLE police clearance | All admins: "Police clearance received" |
| 2026-11-27 | Approved → tutor Palesa Mokoena (`/admin/tutors/8c2200b7-…`), pay R180/hour from 27 Nov, activated | Palesa: "Welcome to Skolopals" |
| 2026-11-27 | Thuli joined the 11:00 session for Amahle (10:48); Palesa confirmed the register (Amahle Present) | Thuli sees the mark |
| 2026-11-27 | Class "Maths Extra Gr 4-7 (Online)", Palesa, Fridays 11:00–11:30, 8 sessions (incl. past Fridays, bug 8); Amahle Mthembu placed | Thuli (placement) |

## 6. Capture

Scenes in `apps/client/scripts/manual/` (`10-tg-recruit.mjs`, `11-tg-apply.mjs`, …). Images in `docs/manual/images/` prefixed `ta` (admin), `tp` (applicant), `tt` (tutor). Fixtures: `docs/manual/tutor_fixtures.py`. The applicant's password is in the session scratchpad only.

## 7. Retakes after deploy

Bugs 2–6 and 9 are fixed in code but not deployed. After deploying, retake:
- `tp03-teach-signed-out` (top bar title) — `node 10-tg-recruit.mjs public`.
- The application steps `tp06`–`tp12b` show "Skolopals" in the top bar. Palesa has already applied, so retaking needs another applicant account (or accept as is).
- `tg02-join-page` (side margin) — needs a session inside its join window.

The recruitment round opened for the guide is still open on UAT (closes 18 Dec).
