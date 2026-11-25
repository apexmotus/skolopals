# Skolopals User Manual — Plan

**Status:** Agreed 2026-11-25 · **Owner:** Mollo Mponya · **Deliverable:** branded PDF

An end-to-end user manual for the Skolopals web application. It follows a learner from enrolment all the way to their first attendance mark, from the point of view of each person involved: Guardian, Learner, Tutor and Admin.

---

## 1. Decisions

| Topic | Decision |
| :--- | :--- |
| Structure | One manual. It opens with the end-to-end journey, then has four role parts: Guardian, Learner, Tutor, Admin |
| Format | **PDF only**, branded: logo, Skolopals colours, cover page, version and date, table of contents, centre contact details on the back page |
| Tone | Plain, friendly English. Short sentences, no jargon, written for a parent on a phone |
| Screenshots | Annotated callouts: cropped to what matters, with numbered markers that match the step text |
| Device | Phone screenshots for Guardian and Learner; desktop for Tutor and Admin |
| Admin coverage | Every admin menu, so the manual doubles as the admin handbook |
| Learner coverage | The aptitude test (taken on the guardian's device) **and** the learner's own portal |
| Attendance | The tutor's Register (Present / Late / Absent / Excused), the guardian's Attendance view, **and** door sign-in/out once that screen is built |
| Extras | FAQ & troubleshooting · Fees & policies · Status & glossary reference · Privacy & consent (POPIA) |
| Sample data | The existing UAT guardian **Ayanda Moloko** and admin **Nasir Jones**, followed from enrolment to the first register mark (see section 6). No new users |
| Bugs | **Fix first, then capture.** The manual shows clean, correct behaviour |
| Sequence | **Strictly** fix → build → write. No manual content before phases 1 and 2 are done |

---

## 2. Phases

### Phase 1 — Bug sweep and fixes

Walk every screen the manual will cover, log what's wrong, fix it, and check each fix in UAT.

Bugs and inconsistencies found so far:

| # | Where | What | Seen in |
| :--- | :--- | :--- | :--- |
| 1 | Enrol → Safety & consent → *Check and send* | ✅ **Resolved.** The summary showed **"Child: Ayanda Moloko"** (the guardian) when the child entered was **Reitumetse Moloko** | Screenshot 06.51.15 vs 06.37.32 |
| 2 | Enrol → Report card | Upload failed with "We could not upload the file. Check your connection and try again." ✅ **Fixed.** | Screenshot 06.38.02 |
| 3 | Aptitude test | "The test is not available / No aptitude test is available" appeared straight after an application was sent. ✅ **Resolved** by running the aptitude seed data. The seed must be loaded in **every** environment (including PROD) before go-live, or every new application hits this. Root cause to close: `db/deploy/` is a stale machine-made bundle (migrations stop at 023; `03_seed.sql` lacks the aptitude bank and the new `consent_types.is_active`). Regenerate it from `db/migrations/` and `db/seed/`, or delete it and point the README at `migrate.sh` + `seed.sh`, before PROD | Screenshot 06.51.43 |
| 4 | Admin → Applications → *Request more information* | The application detail shows "It is required before accepting (D3)". "D3" is an internal spec reference that admins shouldn't see. ⚠️ Marked fixed earlier, but **was still live on 2026-11-25** (`enrolments/[id]/page.tsx:188`). ✅ **Fixed and verified in UAT 2026-11-25:** now reads "You need one before you can accept this application." (No UAT application is currently missing a report card, so the new text was checked in code only) | Screenshot 06.45.00 |
| 5 | Admin → Application → Report card | The PDF viewer shows the file's internal UUID as its name instead of something readable. ✅ **Fixed.** | Screenshot 07.24.57 |

#### UAT sweep — 2026-11-25

Every uncovered screen was walked in UAT as Grace Molefe (guardian), Neo Molefe (learner), Johan van der Merwe (tutor) and Lindiwe Khumalo (admin). Nothing was changed in UAT: no attendance was marked and no forms were submitted.

**Broken — fix before capture**

| # | Where | What | Cause / pointer |
| :--- | :--- | :--- | :--- |
| 6 | Tutor → **My schedule** | The page crashes with "Something went wrong on our side" (reference 2067750816) every time | The page calls `getRooms()` → `GET /reference/rooms`, which is `@Roles('admin')` (`api/src/modules/reference/reference.controller.ts:151`). A tutor gets 403 and the page throws. Use the room name already returned with the class, or open the endpoint to tutors. ✅ **Fixed and verified in UAT 2026-11-25:** rooms endpoint opened to tutors (`@Roles('admin', 'tutor')`). |
| 7 | Tutor → **Overview** → *Next seven days* | Shows rows with **no class name** (Thu 26 Nov 15:30 and 16:45, Tue 1 Dec 15:30). These are other tutors' sessions (Senior English, FET Accounting) for learners Johan shares | `getMySessions()` (`apps/client/src/lib/tutor.ts:66`) returns every session the tutor may read, not only their own classes. Filter to the tutor's class IDs (plus sessions they substitute). ✅ **Fixed and verified in UAT 2026-11-25:** `getMySessions(tutorId, …)` keeps only sessions this tutor teaches (the substitute if set, else the class tutor) and looks up classes covered as a substitute. Also used by My schedule |
| 8 | Tutor → **Attendance register** | Opens on the session **furthest in the future** (Wed 9 Dec), not today's class, and lets a tutor mark attendance for sessions that haven't happened yet | Default to today's (or the most recent) session; block marking future sessions. ✅ **Fixed and verified in UAT 2026-11-25:** the list stops at today (SAST, new `todayAtCentre()`), opens on the most recently started session, and `markAttendance` refuses sessions dated after today. The API's `POST class-sessions/:id/attendance` and the database don't enforce this yet; add a database check with the phase-2 sign-in/out work |
| 9 | Enrol → *Safety & consent* | The required consent **"Health and allergy information"** is collected, but **no screen anywhere** (enrolment, guardian, admin) captures or shows health or allergy details. POPIA v1.1 says guardians and admins can see health notes | Add health notes to enrolment and the learner page, or reword the consent. **Decision 2026-11-25: don't collect health data.** ✅ **Fixed; deployed 2026-11-25** (privacy page still listed the health consent right after deploy, from the API's 1-hour consent cache; delete Redis key `skolopals:reference:consentTypes` to clear it now). Follow-ups awaiting deploy: migration `20261125000009_retention_wording.sql` removes "health notes" from the learner-records retention text, and the privacy page's Information Regulator address is updated to Woodmead (it still said JD House, Braamfontein). migration `db/migrations/20261125000007_retire_health_consent.sql` adds `consent_types.is_active` and retires `health_s27` (not required, not shown; consents already given stay on record). The API's consent list returns active types only; the seeds no longer recreate or grant it. Public copy corrected: the privacy page ("We do not collect…") and *Keeping learners safe* no longer claim the centre holds allergy or medical details; the tutor *My learners* subtitle no longer mentions health. Rehearsed on dev (rolled back). Caches mean the form may show the old consent for up to ~2 h after deploy. **POPIA policy v1.1 must be updated**: the health category, the s27 basis and health-note access all need to come out, and B8's five consents become four |
| 10 | Learner → **Messages** | The empty state says "Start one above", but learners have no compose form | `components/messages/messages-view.tsx:15` empty-state copy is shared. Decide whether learners can start conversations; otherwise change the copy. ✅ **Fixed and verified in UAT 2026-11-25:** the learner page now says "When your tutor or the centre sends you a message, it will appear here." (`emptyDescription` prop on `MessagesView`). Whether learners may *start* conversations is still open |
| 11 | Tutor → **Messages** | Messages from the centre show the sender as **"?" / "Someone"** | Tutor can't resolve the admin sender's name. Return the sender name with the message. ✅ **Fixed and verified in UAT 2026-11-25.** Broader than the centre sender: `profiles` is readable only by its owner and admins (plus active tutors), so *any* non-tutor sender showed as "Someone" to tutors. New migration `db/migrations/20261125000004_thread_people.sql` adds `thread_people(thread)`, which returns **names only** (no phone numbers) to the thread's members; `getThread` uses it as a fallback. Migration applied to UAT; tutor now sees "Lindiwe Khumalo" and "Grace Molefe" |
| 12 | Login page | **No "Forgot password?" link.** A guardian who forgets their password is stuck | Add the reset flow (it's also in the manual's FAQ). ✅ **Fixed and verified in UAT 2026-11-25:** "Forgot password?" on the login page → `/forgot-password` (same reply whether or not the account exists) → email → `/auth/confirm?next=/reset-password` → choose a new password. The login page now also explains an expired link (`?confirm=failed`, which was silently ignored before). Mollo followed a real reset email through to "Choose a new password" (screenshot 10.15.02). Saving the new password itself not yet confirmed. The admin portal's login still has no reset link |

**Gaps — features the manual would need**

| # | Where | What |
| :--- | :--- | :--- |
| 13 | Admin → **Announcements** | Read-only list. There is no way to write an announcement, even though the API has `POST /notifications`. **Decision 2026-11-25: build before the manual.** ✅ **Built; screen verified in UAT 2026-11-25** (form and class list render; no test announcement sent, as it would reach real recipients): *Send an announcement* form on Admin → Announcements: title, optional message, audience (all parents and guardians · all tutors · everyone · families in one class). Sends through the existing `POST /notifications`; in-portal only, no email or WhatsApp |
| 14 | Admin → **Enquiries** | Read-only. You can't open an enquiry, change its status (new → contacted → enrolled/closed), or log a walk-in or phone enquiry. **Decision 2026-11-25: build before the manual.** ✅ **Built and verified in UAT 2026-11-25** (status update tested on Johannes Pretorius and reverted to New). Follow-up fix awaiting deploy: the status dropdown showed the old value after saving; it is now keyed on the saved status (same fix on the substitute dropdown). Admin → Enquiries now has *Log an enquiry* (phone, WhatsApp, walk-in…), shows each enquiry's message, lets you set New / Contacted / Closed, and *Mark as enrolled* links the enquiry to the learner (feeds KPI conversion). Uses the existing enquiry API |
| 15 | Admin → **Timetable** | No way to cancel a single session (e.g. load-shedding) or assign a substitute tutor, though both exist in the data. **Decision 2026-11-25: build before the manual.** ✅ **Built; screen verified in UAT 2026-11-25** (cancel and cover not submitted, since they notify families). **No tutor in the UAT seed qualifies to cover any other tutor's class** (e.g. Precious teaches maths Gr 4–7 only; the seed's 12 Nov English cover breaks the competency rule), so every session correctly says nobody can cover. To show substitutes in the manual, add a competency first (e.g. Precious: Mathematics Gr 8–9, English). new **Admin → Sessions** page (next 3 weeks, by day). *Cancel session* with a reason, optionally telling the families and tutor (on by default); *Put it back on*; *Save cover* assigns a substitute, offering only tutors recorded for the subject at every grade in the class's language (checked again on save), and notifies them. Migration `db/migrations/20261125000008_substitute_access.sql` lets a substitute see the covered class's learners from a week before to two weeks after the session, so their Register works; the Register now lists sessions they cover and drops ones covered by someone else |
| 16 | Guardian → **My learners** | No "Enrol another child" button. A family with one learner has no obvious way to add a second. **Decision 2026-11-25: build before the manual.** ✅ **Built and verified in UAT 2026-11-25:** "Enrol another child" (or "Enrol a child") button on Guardian → My learners, linking to /enrol |

**Wrong numbers or wording**

| # | Where | What |
| :--- | :--- | :--- |
| 17 | Admin → **KPIs** vs **Dashboard** | KPIs say **11** active learners; the dashboard and the Learners list say **10**. **Cause:** `v_learner_counts` counted every `learners` row active *on the 1st of the month*, including declined applicants (Sibusiso) and learners who left mid-month (Owen), while the dashboard counts status = active *now*. ✅ **Fixed and verified in UAT 2026-11-25** (KPIs shows 10, matching the dashboard): migration `db/migrations/20261125000006_learner_counts.sql`. Applicants who never became learners are excluded, and "active" means at the end of the month (today, for this month). Rehearsed against dev with a fixture copying UAT (rolled back): before 11 vs 10, after **10 = 10** |
| 18 | Admin → **KPIs** → Retention | October shows **Active 0, New 11**. Active should be 11. The table also lists 12 empty months back to Dec 2025. ✅ **Fixed and verified in UAT 2026-11-25** (same migration): the table now shows *At the start · New · Left · At the end · Retention*, and the empty months before the centre opened are hidden. Retention is now learners still there at the end ÷ learners there on the 1st. Rehearsal: October 0 → **10 at the end**; November **90.0%** (was 91.7% under the old formula active ÷ (active + left)) |
| 19 | Admin → Learners | "Place in a class" is offered for learners who **left**, were **declined**, or are still **awaiting review** (Owen, Sibusiso, Sanele). ✅ **Fixed and verified in UAT 2026-11-25:** the link shows only for learners with an active enrolment (or existing placements to manage) |
| 20 | Internal references in the UI | "BP section 12" (Tutor → Assessments), "business plan, section 17" and "…turns the business plan's illustrative surplus into a computed one" (Expenses), "business plan, section 24" (KPIs). Same kind of issue as bug 4. ✅ **Fixed and verified in UAT 2026-11-25:** all four reworded, plus "not seeded" on Admin → Timetable → Add a term |
| 21 | Raw codes shown to users | Months as "2026-11" (Tutor → Sessions taught, KPIs); session status as `scheduled` (Tutor → My schedule); enquiry sources and statuses as `walk_in`, `whatsapp`, `new` (Enquiries); relationship "mother" in lower case for UI-entered guardians vs "Mother" for seeded ones (Learners). ✅ **Fixed and verified in UAT 2026-11-25:** new shared `monthLabel`, `labelFor` + label maps (session status, payment method, enquiry source/status) and `capitalise`. Applied to KPIs, Sessions taught, My schedule, Enquiries, Learners, Application detail, Billing payments, the guardian statement ("invoice"/"payment") and invoice payment method ("payshap") |
| 22 | Guardian → **Attendance** | Subtitle says "Every session your learners have **attended**", but the list includes Absent and Excused. No filter by child. ✅ **Fixed and verified in UAT 2026-11-25:** subtitle now "Each of your learners' sessions, and whether they were present, late, absent or excused." The filter by child is not done |
| 23 | Guardian → Learner → *Authorised to collect* | "Last 4 digits of their ID" is **optional** here but presented as expected at enrolment, and staff rely on it at the door. Make it required (it matters for the sign-out screen in phase 2). ✅ **Fixed and verified in UAT 2026-11-25:** required for anyone other than the guardian, at enrolment (server check with a clear message) and on the learner page (label and validation). Collectors already saved without digits stay as they are; the phase-2 door screen must handle them |
| 25 | Tutor → **Attendance register** | **Cancelled** sessions (e.g. Wed 4 Nov, load-shedding) are still listed with no label, so a tutor could mark a register for a class that never ran. Hide them or label them "cancelled". ✅ **Fixed and verified in UAT 2026-11-25:** cancelled sessions are left out of the list (Wed 4 Nov's in-centre classes gone, the online one that ran is kept), and `markAttendance` refuses them |
| 24 | Guardian → **Messages** | The "To" list offers **every tutor** (e.g. Kagiso, who teaches none of Grace's children), but **not the centre/admin**, although the subtitle says "Talk to your learner's tutor or the centre". ✅ **Fixed and verified in UAT 2026-11-25:** "To" now lists **The centre (Skolopals office)** first, then only the tutors teaching the parent's children. New migration `db/migrations/20261125000005_centre_staff_ids.sql` returns the active admins' ids, and a message to the centre goes to all of them. Migration applied to UAT; Grace's list shows the centre, Boitumelo, Johan and Thabiso. Sending a real message to the centre was not tested (it would reach every admin, including the owner) |
| 26 | Guardian → bell icon | The label says "Notifications, **1 need attention**" when there is only an unread update and nothing is due. Also "needs", not "need". ✅ **Fixed and verified in UAT 2026-11-25:** now "Notifications, N new" |
| 27 | Guardian → invoice receipt | Footer says "Fees are paid by **EFT or cash**". It leaves out PayShap, now the main way to pay. ✅ **Fixed and verified in UAT 2026-11-25:** now "Fees are paid by PayShap, EFT or cash. We never ask for card details." |
| 28 | Public site on a phone | The top bar shows the page name ("Home") on the home page, but "Skolopals" on the Enrol page instead of "Enrol" (screenshots 08.25.22, 08.25.55). Phone layout otherwise good. ✅ **Fixed and verified in UAT 2026-11-25:** `MobileNav` takes extra `titles`; the public bar now names Enrol, About, Keeping learners safe, Work with us, Terms and Privacy |
| 29 | Admin → Application (Sanele Zulu) | Report card shows "The file could not be loaded". Probably the seed points at a storage file that was never uploaded; check before using this application in screenshots. **Cause (2026-11-25):** not the teardown. `db/uat/01_seed_uat.sql` calls `submit_enrolment` with a made-up staging path and never uploads a file, so *every* seeded report card is missing (only real uploads, like Ayanda's, work). The teardown truncates tables but never touches storage, so report cards that testers really uploaded are left orphaned in the `learner-documents` bucket after a reseed. Fix later if needed: a seed step that uploads a placeholder PDF per seeded document, and a storage clean-up in the teardown. For the manual, use Ayanda's application |

**Checked and working:** guardian Overview, My learners, learner edit, Attendance, Progress reports (attendance totals match the register), Fees & statement, Resources, Notifications · learner Overview, Timetable, Reports, Resources, plus the security check that a learner can't open `/parent/account` · tutor Learners, Assessments, Reports, Sessions taught, Reviews, Notifications · admin Dashboard, Users, Learners, Tutors, Timetable, Expenses, Enquiries list, Announcements list, KPIs.

**Not yet verified:**
- Saving an attendance mark on the Register. This changes UAT data, so it's deferred to capture with the sample family.
- Phone-width layout: ✅ checked from Mollo's phone screenshots of Home and Enrol (08.25.22, 08.25.55). The portal pages at phone width are still to check during capture.

**Housekeeping (not bugs):**
- UAT contains real people's email addresses (e.g. Gmail and Yahoo sign-ups by family and contacts) and stale test accounts (`admin.test`, `tutor.test`, `student.test` all as Parent; "Michael Jacobs", Left, no guardian). Clean these up before using UAT for the manual's screenshots. Real personal data in UAT is also a POPIA concern.
- `UAT-TEST-DATA.md` says Johan has 7 classes; the timetable has 6.

### Phase 2 — Build the door sign-in/out screen

> **2026-11-25:** design interview done. The spec is in `docs/SPEC-2026-11-door-and-online-attendance.md` (door for in-centre classes; tracked join link plus tutor-confirmed register for online and hybrid). Approved and **built 2026-11-25, awaiting deploy**: migration `20261125000010_door_and_online_attendance.sql` (rehearsed on dev with a fixture: all 10 rule checks passed, then rolled back); tutor Register door and online register; Admin → *At the door*; `/join/<session>` and Join links on family timetables; door times on the guardian's Attendance; the guardian's *Leaving the centre on their own* permission; API job `GET /internal/jobs/late-pickups`. The 10-minute late-pickup check runs in the database via Supabase Cron (`20261125000011_late_pickup_schedule.sql`), since Vercel Hobby only allows daily crons.


The database (`session_check_ins`) and the API (`GET/POST/PATCH class-sessions/:id/check-ins`) already exist. Only the screen is missing.

- It records each learner's arrival, then their departure and who collected them.
- The collector must be on the learner's authorised list. Staff check them against the **last 4 digits of their ID**, which the guardian gave at enrolment.
- The screen needs its own short design interview before it's built. Open questions: who uses it (tutor or front desk), which device, where it lives (tutor portal or admin), what happens when the collector isn't on the list, and whether guardians see sign-out times.

**Optional, not yet agreed:** the POPIA policy v1.1 promises some features before go-live. If they ship before the manual, the manual should cover them:
- the WhatsApp wording in the updates consent
- an opt-out on every bulk message
- "Download my data" for parents
- a monthly purge screen for records past retention
- a breach register

See `POPIA-policy-v1.1-covering-note.docx` section 5.

### Phase 3 — Capture and write

1. Create the sample family in UAT and drive the whole journey in Chrome, capturing every screen.
2. Annotate the screenshots: crop them and add numbered callouts.
3. Write the four role parts and the extras.
4. Build the branded PDF, then review it with Mollo.

---

## 3. The end-to-end journey (Part 0 of the manual)

```
Guardian signs up → confirms email → logs in
  → Enrol a learner (6 steps: Package · About your child · Report card · Subjects · Tutor · Safety & consent)
  → Learner takes the aptitude test (on the guardian's device)
  → Admin reviews: report card + aptitude result → Accept / Request more info / Decline
  → Invoice raised (R150 registration + pro-rata tuition), due within 7 days
  → Guardian pays with PayShap → uploads proof
  → Admin verifies (or rejects with a reason → guardian re-uploads)
  → Learner enrolled and placed in classes → timetable appears
  → Learner attends → signed in at the door → Tutor marks the Register → signed out to an authorised collector
  → Guardian sees attendance the same day
  → Monthly cycle: invoice on the 15th, due on the 1st, R150 late fee after 3 days overdue
```

---

## 4. Coverage by role

✅ = already in the screenshots (`screenshots/`, 2026-11-25) · ⬜ = still to capture

### Part 1 — Guardian (client portal, `/parent`)

| Topic | Status |
| :--- | :--- |
| Public website: Home, Subjects, Tutors, Timetable, Holiday Programmes, Fees, Contact | ✅ Home only; ⬜ the rest |
| Create an account, confirm email, log in | ✅ |
| Forgot / reset password | ⬜ |
| Overview dashboard (empty, in progress, enrolled) | ✅ |
| Enrol a learner: all 6 steps, plus the Check and send summary | ✅ |
| Application tracker (Enrol → Assess → Review → Pay → Done) | ✅ |
| Replace a report card / respond to "more information" | ✅ partly |
| Pay with PayShap: Review → Pay → Upload proof → Being checked | ✅ |
| Proof rejected → upload a new one | ✅ |
| Fees & statement (`/account`), invoice detail, receipt | ✅ |
| Timetable | ✅ |
| My learners, learner detail | ⬜ |
| Attendance | ⬜ |
| Progress reports | ⬜ |
| Messages, Notifications, Resources | ⬜ |
| Updates from the centre / Mark as read | ✅ |
| Adding a second child | ⬜ |

### Part 2 — Learner (client portal, `/learner`)

| Topic | Status |
| :--- | :--- |
| Aptitude test: intro, questions, "Well done… hand back to your grown-up" | ✅ intro and end; ⬜ a question screen |
| How a learner gets their own login | ⬜ |
| Overview (Next classes) | ⬜ |
| Timetable, Progress, Resources, Messages, Notifications | ⬜ |

### Part 3 — Tutor (client portal, `/tutor`)

| Topic | Status |
| :--- | :--- |
| Accepting the invitation / first login | ⬜ |
| Sessions and Schedule | ⬜ |
| **Register: marking Present / Late / Absent / Excused** | ⬜ |
| Door sign-in/out (after phase 2) | ⬜ |
| Learners | ⬜ |
| Assessments, Reports, Reviews | ⬜ |
| Messages, Notifications | ⬜ |

### Part 4 — Admin (admin portal, `/admin`)

| Menu | Status |
| :--- | :--- |
| Centre dashboard | ✅ |
| Users & invitations (adding tutors and admins) | ⬜ |
| Applications: queue tabs (To review, Not finished, Awaiting payment, Needs placement, Declined) | ✅ |
| Application detail: report card, aptitude result, classes with seats | ✅ |
| Accept / Request more information / Decline / Let them take the test again | ✅ partly |
| Payments: verify / reject a proof | ✅ |
| Learners, learner detail | ⬜ |
| Tutors, tutor detail | ⬜ |
| Timetable and placement | ⬜ |
| Billing: run monthly invoices, apply late fees, PayShap details, record a payment | ✅ partly |
| Expenses | ⬜ |
| Enquiries | ⬜ |
| Announcements | ⬜ |
| KPIs | ⬜ |
| Door sign-in/out (if it lives in admin) | ⬜ |

---

## 5. Extras

- **FAQ & troubleshooting.** Covers: email not received, upload failed, test not available, proof rejected, forgot password, wrong details on an application, paying late.
- **Fees & policies.**
  - Packages: Group 1 subject R450, Group 2 R750, Group 3 R950, All-subject R1,100, Homework R500, Academic Plus R1,250.
  - R150 once-off registration fee, and a pro-rata first month.
  - Invoices are issued on the 15th and due on the 1st. A first invoice must be paid within 7 days of acceptance.
  - A R150 late fee applies to invoices more than 3 days overdue.
  - Payment is by PayShap/EFT or cash; no card payments.
  - Confirm every figure against the live price list before publishing.
- **Status & glossary.**
  - Application stages: Ready to review, Not finished, Awaiting payment, Needs placement, Declined, Missing report card.
  - Payment and invoice statuses: To check, Unpaid, Paid.
  - Attendance statuses: Present, Late, Absent, Excused.
  - Terms: ShapID, aptitude band, package, pro-rata.
- **Privacy & consent (POPIA).**
  - The five consents in the enrolment form: three required, two optional.
  - What is collected and why, how to withdraw consent, and who to contact.
  - Aligned with POPIA policy v1.1 (`POPIA-policy-v1.1-for-review.docx`).

---

## 6. Capture setup (UAT)

- **Environment:** the UAT client and admin apps (`skolopals-web-uat.vercel.app`, `skolopals-admin-uat.vercel.app`).
- **Approved actions in UAT:**
  - Create new accounts, using Gmail plus-addressing for a real inbox (e.g. `mollodagod+manual@gmail.com`).
  - Act as admin (seed admin) and as tutor (e.g. Johan van der Merwe).
  - Upload the sample `Report card.pdf` and `Proof of payment.pdf` from the Dev folder.
- **Seed accounts and password:** see `UAT-TEST-DATA.md`.
- **Sample family (updated 2026-11-25):** don't create new users. Use the existing, already-verified UAT accounts Mollo provided:
  - Guardian: `mollodagod+aya@gmail.com` (Ayanda Moloko)
  - Admin: `mollodagod+nass@gmail.com` (Nasir Jones, Super Administrator)
  - Tutor: Johan van der Merwe (seed account, see `UAT-TEST-DATA.md`)
  - Passwords were given in chat and are not stored here.
  - ⚠️ That guardian's child is *also* named "Ayanda Moloko", which will confuse readers ("Ayanda's application… pay for Ayanda"). Consider renaming the child (e.g. Lerato Moloko) before capture.
- **Phone shots:** Chrome at phone width (around 390 px) for the guardian and learner sections.

---

## 7. Open items

- [ ] Phase 1: complete the bug sweep, fix, re-test.
- [ ] Phase 2: design interview for the door sign-in/out screen, then build it.
- [ ] Decide whether the POPIA go-live features are built before the manual.
- [ ] Confirm the centre contact details for the back page (phone 067 244 7296; Information Officer email still pending from the client).
- [ ] Confirm the branding assets: logo file and colour values.
