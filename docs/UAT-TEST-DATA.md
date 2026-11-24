# UAT Test Data & E2E Execution Guide

| | |
| :--- | :--- |
| **Environment** | UAT only — Supabase project `dhmjzshlznhqohvkdcpz`. Never production. |
| **Seed** | [`db/uat/01_seed_uat.sql`](../db/uat/01_seed_uat.sql) · reset: [`db/uat/99_teardown_uat.sql`](../db/uat/99_teardown_uat.sql) · runner: [`db/scripts/seed-uat.sh`](../db/scripts/seed-uat.sh) |
| **Test cases** | [`E2E-TEST-PLAN.md`](E2E-TEST-PLAN.md) — this guide says which seeded data each case uses and where the plan has to be adjusted |
| **"Today" in the data** | Friday **2026-11-20**, about five weeks after the centre opened on the first day of 2026 Term 4 (13 Oct) |

The seed builds the centre as it would look once it is live. It has staff, tutors with competencies and pay, 11 families, 13 learners, a weekly timetable with held, cancelled and substitute sessions, attendance and sign-outs, assessments, learning plans, reports, two monthly billing runs, payments, arrears, a late fee, a credit note, programmes, messages, announcements, enquiries, reviews and expenses.

Wherever the app has an RPC, the seed calls it as the person who would do the action: the parent submits the enrolment, the admin activates it, and the tutor records the assessment. The seeded data therefore passes the same triggers and rules that the UI enforces.

---

## 1. Before you load it

1. **Make sure the UAT apps read `dhmjzsh…`.** The `deploy-uat` job builds UAT against this project from the `uat` GitHub Environment's secrets and variables (see [`DEPLOY.md`](DEPLOY.md#uat-configuration--uat-github-environment)). It refuses to deploy if they point anywhere else. Check that the latest Deploy run's `deploy-uat` and `smoke-uat` jobs are green.
2. **Bring the schema up to date.** Apply every file in `db/migrations/` in order. The seed refuses to run against the old marketplace schema.
3. **Load the reference seeds.** Run `db/seed/01_reference.sql` to `05_expenses.sql`.
4. **Start from an empty UAT.** The seed refuses to run if learners, tutors, terms or invoices already exist, because invoice numbers and capacities assume a clean start. Use the teardown first.

## 2. Load / reset

```bash
cd db
# Use the direct connection or the session pooler (port 5432), not 6543.
./scripts/seed-uat.sh "postgresql://postgres:<pw>@db.dhmjzshlznhqohvkdcpz.supabase.co:5432/postgres"            # seed
./scripts/seed-uat.sh "postgresql://...dhmjzshlznhqohvkdcpz...:5432/postgres" --reset                          # wipe + seed
./scripts/seed-uat.sh "postgresql://...dhmjzshlznhqohvkdcpz...:5432/postgres" --teardown                       # wipe only
```

The script refuses any URL that does not contain the UAT ref.

**SQL editor alternative:** open the **UAT** project's SQL editor, paste the file, add this as the first line, then run it:

```sql
set skp.project_ref = 'dhmjzshlznhqohvkdcpz';
```

Without that line, both files refuse to run. On success the seed prints a summary: 20 accounts, 9 active learners, 27 invoices, and the outstanding balance per family.

**What the teardown removes:** all operational data (including anything testers created), the `@uat.skolopals.test` accounts and the E2E plan's `@test.local` accounts. Reference data and every other auth account (e.g. your real superadmin) are kept.

The seed was rehearsed end to end (seed → guards → teardown → reseed) against a local Postgres built from the same migrations with a GoTrue-shaped `auth.users`.

---

## 3. Accounts

**Password for every seeded account: `Uat-Skolopals-2026!`** (UAT only — never reuse it). All accounts are pre-confirmed. `.test` addresses cannot receive mail, so for flows that need an inbox (sign-up confirmation, password reset, invite emails) use a real address, e.g. Gmail plus-addressing.

### Staff & tutors — Admin portal (`/admin`) / client portal (`/tutor`)

| Person | Email | Role | Use for |
| :--- | :--- | :--- | :--- |
| Refilwe Kgosana | `refilwe.kgosana@uat.skolopals.test` | superadmin | Creating admins; "Super Administrator" subtitle (TC-AUTH-07) |
| Lindiwe Khumalo | `lindiwe.khumalo@uat.skolopals.test` | admin | Day-to-day admin: enrolment queue, billing, timetable, enquiries (TC-AUTH-05/06, ADM, BILL, OPS) |
| Kagiso Mokgatle | `kagiso.mokgatle@uat.skolopals.test` | tutor (salaried) | Foundation reading class; Lwazi & Zanele |
| Johan van der Merwe | `johan.vandermerwe@uat.skolopals.test` | tutor | Busiest tutor: 7 classes incl. Afrikaans, online and one-on-one |
| Boitumelo Seleke | `boitumelo.seleke@uat.skolopals.test` | **tutor + parent** | Multi-role account: teaches Senior English, and is mother of Lesedi |
| Precious Ndlovu | `precious.ndlovu@uat.skolopals.test` | tutor | Intermediate maths; substituted one English session; pay rate changed 1 Nov |
| Thabiso Mabena | `thabiso.mabena@uat.skolopals.test` | tutor | FET Accounting |
| Annelie Swanepoel | `annelie.swanepoel@uat.skolopals.test` | tutor — **suspended + deactivated** | Login must be blocked; must not appear on `/tutors` |

### Parents & learner — client portal

| Person | Email | Children (grade · package) | State on 2026-11-20 |
| :--- | :--- | :--- | :--- |
| Sipho Nkosi (**Guardian B**) | `sipho.nkosi@uat.skolopals.test` | Ayanda (Gr 5 · Group 1) · Lwazi (Gr 3 · Group 1) | Paid to date; **Dec invoice R900 open** (TC-BILL-04). His message to Precious is still unread by her |
| Grace Molefe | `grace.molefe@uat.skolopals.test` | Neo (Gr 11 · Group 3) · Kamogelo (Gr 8 · Group 2) | Model payer; December paid early; holiday programme R750 open |
| Marlene Botha | `marlene.botha@uat.skolopals.test` | Ruan (Gr 10 · Group 2, **Afrikaans**) | Dec R750 + holiday R750 open; unread reply from admin |
| Pieter Botha | `pieter.botha@uat.skolopals.test` | Ruan (second guardian) | **Not** the billing contact: sees Ruan but no invoices |
| Nomsa Dlamini | `nomsa.dlamini@uat.skolopals.test` | Zanele (Gr 2 · Homework) | **Arrears**: Nov part-paid, late fee unpaid, Dec unpaid (R1,150) |
| Dineo Mahlangu | `dineo.mahlangu@uat.skolopals.test` | Tshepo (Gr 12 · Academic Plus) | Joined 26 Oct with an admin-set R600 part-month; Dec catch-up invoice R3,100, part-paid |
| Fatima Petersen | `fatima.petersen@uat.skolopals.test` | Owen (Gr 8) — **left 14 Nov** | Account in credit (R225 credit note); pending review |
| Lerato Mabaso | `lerato.mabaso@uat.skolopals.test` | Karabo (Gr 9 · One-on-one 4-lesson block) | Paid; medical accommodation (dyslexia) |
| Busisiwe Zulu | `busisiwe.zulu@uat.skolopals.test` | Sanele (Gr 6 · Group 2) | **Enrolment pending** in the admin queue |
| Mandla Shabalala | `mandla.shabalala@uat.skolopals.test` | Sibusiso (Gr 7) | Enrolment **declined** |
| Thuli Mthembu | `thuli.mthembu@uat.skolopals.test` | — | Signed up, no children: empty states everywhere |
| Neo Molefe | `neo.molefe@uat.skolopals.test` | — (**learner login**) | TC-SEC-03: sees only himself, never billing or his brother |

Not seeded on purpose: the E2E plan's scripted personas (Thandi/Thabo/Lerato Mokoena, Naledi Dube, Kgomotso Mokoena). Create them through the UI as the plan describes.

---

## 4. What the centre looks like

### Terms & rooms
- **Terms:** 2026 Terms 1–4 (Term 4 = **13 Oct – 9 Dec 2026**) and 2027 Terms 1–4 (from `load-terms-2027.sql`). The 2026 dates follow the public-school calendar; check them against the gazette.
- **Rooms:** Room A (Foundation & Intermediate, 8), Room B (Senior, 10), Study Hall (16), Old storeroom (4, **inactive**).

### Timetable — 2026 Term 4

| Class | Tutor | When (SAST) | Where | Learners |
| :--- | :--- | :--- | :--- | :--- |
| Foundation Reading Gr 1-3 (English) | Kagiso | Mon & Wed 14:00–15:00 | Room A | Lwazi, Zanele |
| Intermediate Maths Gr 4-6 (English) | Precious | Tue & Thu 14:00–15:00 | Room A (cap **4**) | Ayanda, Lesedi |
| Senior Maths Gr 8-9 (English) | Johan | Mon & Wed 15:30–16:30 | Room B | Kamogelo (Owen until 14 Nov) |
| Senior English Gr 7-9 (English) | Boitumelo | Tue & Thu 15:30–16:30 | Room B | Kamogelo |
| Gr 10 Wiskunde (Afrikaans) | Johan | Mon 16:45–17:45 | Room B | Ruan |
| Gr 10 Fisiese Wetenskappe (Afrikaans, **online**) | Johan | Wed 18:30–19:30 | online — per-session `meeting_url` | Ruan |
| FET Accounting Gr 11-12 | Thabiso | Thu 16:45–17:45 | Room B | Neo, Tshepo |
| FET Mathematics Gr 10-12 | Johan | Sat 08:30–10:30 | Study Hall | Neo, Tshepo |
| FET Physical Sciences Gr 10-12 | Johan | Sat 10:45–12:15 | Study Hall | Neo, Tshepo |
| One-on-one Maths – Karabo M. | Johan | Wed 17:00–18:00 | Study Hall (cap **1**, full) | Karabo |

Sessions are generated for the whole term (118 in total). Every session before 20 Nov is marked **held** with attendance, except:
- **Wed 4 Nov:** all in-centre sessions are **cancelled** (load-shedding). The online class still went ahead.
- **Thu 12 Nov:** Precious **substituted** for Boitumelo in Senior English.
- Foundation Reading has sign-in and sign-out records with authorised collectors from 6 Nov onwards.

Attendance is about 80% present, with late, excused and absent mixed in deterministically per learner and session. Zanele is absent more often than the others. The exact rates change on each reseed, because they are derived from random IDs.

### Academic
- **Initial assessments** for all 10 placed learners (all six domains for primary learners, subject-based for FET).
- **Monthly monitoring** for Lwazi, Ayanda, Kamogelo, Neo, Ruan and Tshepo, so `v_assessment_improvement` shows real gains (e.g. Lwazi reading 35% → 52.5%).
- **Learning plans:** Ayanda has a **superseded** plan and a newer active plan. Lwazi, Zanele, Kamogelo and Neo each have an active plan.
- **Term 4 reports:**

| Learner | Report state |
| :--- | :--- |
| Lwazi | Published and **acknowledged** by Sipho |
| Kamogelo | Published and **acknowledged** by Grace |
| Neo | Published, **not yet acknowledged** |
| Ayanda | **Draft**, hidden from parents |
| Ruan | **Draft**, hidden from parents |

### Safeguarding & POPIA
- Medical notes for Lwazi (asthma), Zanele (**severe peanut allergy**), Ayanda and Karabo. These are admin only; tutors must see none.
- Zanele's neighbour **Thandeka Mahlaba** was an authorised collector only until 31 Oct (an **expired** collector).
- Optional consents are granted by the Nkosi, Molefe, Seleke and Mahlangu families, and declined by everyone else.
- **Michael Jacobs** left in 2021 and is past the 5-year retention period, so he is listed in `v_retention_due`.

### Billing timeline (SPEC §9)

| Date | Event |
| :--- | :--- |
| 13–14 Oct | 9 activations, each raising a **R150 registration invoice** as it happens (SKP-2026-0001…0009), plus Karabo's hand-made one-on-one block invoice (R650) |
| 15 Oct | **Run for November** (issued 15 Oct, due 1 Nov). Catches up October for everyone who started on 13 Oct: one consolidated invoice per family |
| 26 Oct | Tshepo is approved with an **admin-set R600** first month, plus registration and a crash-course booking |
| 5 Nov | `apply_late_fees('2026-11-05')` charges Nomsa **R150** on a **new** invoice |
| 12 Nov | Nomsa makes a R500 cash part-payment |
| 14 Nov | Owen leaves: enrolment ended, learner `left`, R225 credit note |
| 15 Nov | **Run for December** (due 1 Dec). Owen is no longer billed. Tshepo's October, November and December are caught up on one invoice (R3,100) |
| 18–19 Nov | Grace pays December; Dineo part-pays; December holiday bookings are invoiced |

Totals: R21,050 invoiced, R14,200 collected. Open balances: Sipho R900 · Grace R750 · Marlene R1,500 · Nomsa R1,150 (overdue) · Dineo R2,100 · Boitumelo R450. Fatima is R225 in credit; Lerato is at R0.

> Invoice numbers 0001–0010, 0017–0019 and 0026–0027 are fixed. The numbers inside each billing run (0011–0016 and 0020–0025) are assigned in account-ID order, so **which family gets which number changes on every reseed**. Refer to invoices by family, not by number.

### Communication & other

| Area | Seeded |
| :--- | :--- |
| **Message threads** | Grace↔Johan (read), Marlene→admin (reply unread by Marlene), admin→Nomsa arrears reminder (unread), Sipho→Precious (unread by Precious), staff broadcast (unread by three tutors) |
| **Announcements** | Welcome (12 Oct), load-shedding (3 Nov), December programme (16 Nov, Gr 10–12 parents), staff reports deadline (17 Nov), with a mix of read and unread |
| **Enquiries** | 8 across `phone`, `facebook`, `whatsapp`, `walk_in`, `website`, `flyer` and `referral`. Statuses: 3 `new`, 1 `contacted`, 2 `enrolled` (linked to Neo and Tshepo), 2 `closed` (one from 2025) |
| **Programmes** | Matric Maths Crash Course (online Sundays, partly held, with attendance) and December Holiday Revision (14–18 Dec, R750, 2 booked of 12) are published. **Grade 7 Bridging Camp is unpublished** and must not show publicly |
| **Reviews** | Published: Johan ×2 (rating 4.5), Kagiso, Precious. One **pending** (Fatima). One **rejected** (it contained a phone number) |
| **Resources** | 5 resources, one for each audience type: class group ×2, grade, single learner, all |
| **Expenses** | Set-up costs in September, a full October, and November to date, across the BP §17 categories |

---

## 5. How the E2E plan maps onto this data

The plan was written against an empty local database. With this seed loaded, run it as written **except for the adjustments below**.

| Test | Use / adjustment |
| :--- | :--- |
| TC-PUB-03/04/05 | Packages from the reference seed. `/tutors` should show **5** tutors (not Annelie) with ratings from published reviews. `/programmes` should show the Crash Course and December Revision but **not** the Bridging Camp. `/timetable` should show the classes above with **no `meeting_url`** |
| TC-PUB-07, TC-OPS-03 | The status values are `new → contacted → enrolled / closed`. **There is no `converted` status** (the plan's wording). Eight enquiries already exist, so the funnel has real numbers |
| TC-AUTH-01 | Thandi signs up as the plan says. Thuli is an existing example of a parent with no children |
| TC-AUTH-02/03 | Try to sign in to admin as `grace.molefe@…` (parent), `johan.vandermerwe@…` (tutor) and `neo.molefe@…` (learner). Try to sign in to client as `lindiwe.khumalo@…` (admin only) |
| TC-AUTH-04 | Also check `boitumelo.seleke@…`: a tutor **and** a parent should reach both `/tutor` and `/parent` |
| TC-AUTH-05/06/07 | Act as Lindiwe (admin) and Refilwe (superadmin). Inviting Naledi Dube still works |
| Deactivation | `annelie.swanepoel@…` must not be able to sign in, and should show as inactive in `/admin/users` |
| TC-ADM-03 | Precious already has two pay rates (R110 from 1 Oct, closed by R125 from 1 Nov). Repeat the plan's steps on Naledi |
| **TC-ADM-04** | **Changed.** Terms are seeded, so "2026 Term 4" already exists. Instead: add **2028 Term 1** (2028-01-12 → 2028-03-24), then try an overlapping term (2027-12-01 → 2028-01-20). That must be rejected. Rooms: "Main Room" can still be added |
| **TC-ADM-06** | **Changed.** Use the seeded Term 4 (13 Oct – 9 Dec). Tue + Thu gives **17 sessions** (9 Tuesdays + 8 Thursdays), not 9 |
| TC-ENR-02/03 | The real consent codes are `enrolment_s35`, `health_s27` and `cross_border_s72` (required), and `marketing_photos` and `marketing_updates` (optional). The plan's `child_processing` etc. are placeholders |
| TC-ENR-04 | Thabo's registration invoice will be the next number in the sequence (around SKP-2026-0028), not 0001. Busisiwe's **Sanele** is already waiting in the queue as a second approval case |
| TC-ENR-05 | **Intermediate Maths (cap 4)** has 2 learners: placing Sanele makes 3. **One-on-one Karabo (cap 1)** is already full, so any extra placement must be rejected |
| **TC-ENR-06** | **Changed.** Decline sets status **`declined`**, not `ended` (`enrolment.repository.ts`). Mandla's Sibusiso is an existing declined example |
| TC-ATT-01/02 | Johan or Kagiso already have a register history. Thabo's new class should list **17** sessions (TC-ATT-02 says 9) |
| TC-ATT-03 | Use the seeded online class: Marlene (enrolled parent) sees the Wednesday `meeting_url`; Sipho (not enrolled) does not; `/timetable` never does |
| TC-ATT-04 | Ready-made negatives: sign out **Zanele** with **Thandeka Mahlaba** (expired 31 Oct, must be rejected), or sign out **Ayanda** with Lwazi's collector **Gogo Thembi Nkosi** (wrong learner, must be rejected) |
| TC-ACAD-03/05 | Already-seeded examples: Ayanda's and Ruan's drafts must be invisible to Sipho and Marlene. Neo's published report waits for an acknowledgement from Grace |
| TC-ACAD-06 | `v_assessment_improvement` already has 7 improving learner/domain pairs |
| TC-BILL-02 | Running `2026-12` again must add **0 lines** for the seeded families (December was billed on 15 Nov). It should add only the Mokoena family's lines (expected R2,800) |
| **TC-BILL-04** | **Sipho Nkosi's December invoice is R900** and unpaid. Record R500 cash ("Cash receipt 7") → `part_paid`, balance R400 |
| TC-BILL-05 | Nomsa is the live example. **See finding F1** before you click "Apply late fees" |
| TC-BILL-06 | Compare Sipho (clean history), Nomsa (arrears + late fee), Fatima (credit) and Pieter (no billing access) |
| TC-OPS-01/02 | Threads and announcements exist with known unread counts (§4) |
| TC-OPS-04/05 | September–November expenses are seeded. Expect a negative surplus while the centre ramps up (Sep −R11,550; Oct and Nov also negative) |
| TC-SEC-01 | Guardian B = Sipho (seeded). Guardian A = Thandi (created during testing) |
| TC-SEC-02 | Johan should see exactly 5 learners (Neo, Kamogelo, Ruan, Karabo, Tshepo; Owen has left), and **0** medical notes, consents, invoices or payments |
| TC-SEC-03 | `neo.molefe@…` sees only Neo, his own report, and **0** invoices |
| TC-SEC-05 | No psql needed: Michael Jacobs is already in `v_retention_due` |

---

### Since SPEC-2026-11 (pre-paid applications, 2026-11-25)

- The October history above is kept as it happened, under the **old** rules: registration-only invoices on approval, tuition from the monthly run, Tshepo's admin-set first month. `uat_seed.activate` records it directly; today's accept/pay/activate flow is not used for it. Every approved learner also gets a finished aptitude test and a report card row, which the new rules require.
- Each seeded report card is a row with **no file behind it** in UAT storage, so "Open report card" on the admin review page fails for seeded learners. Upload a real one (as the parent, from the portal, while an application is under review) to test previews.
- Sibusiso's decline now carries the reason "No class available for this grade/subject".
- New flows to test from scratch: apply as a parent (wizard + report card) → aptitude test → admin Accept (Applications) → parent pays with PayShap and uploads proof → admin verifies (Payments). Enter the centre's ShapID first under **Billing → PayShap details**.

## 6. Findings from rehearsing the seed — log these as defects or confirm as intended

| # | Finding | Where | Effect |
| :--- | :--- | :--- | :--- |
| **F1** | **Late fees compound.** `apply_late_fees` treats a *late-fee invoice* as an overdue invoice in its own right. Running it today charges Nomsa a second R150 because the first fee is unpaid. The R150 fee on 0019 itself attracts a fee | `20261020000020_billing_run.sql` `apply_late_fees` | A new R150 every time the job runs after a fee goes unpaid. Confirm with the business; probably exclude `late_fee`-only invoices |
| **F2** | `v_learner_counts` / `v_learner_retention` count **every** learner row, including `prospective` and declined learners (Sibusiso is counted as active in November) | `20261020000013_finance_kpis.sql` | Active-learner and retention KPIs are overstated; this also skews break-even |
| **F3** | `v_monthly_revenue.collected_cents` is cash settled **against invoices issued in that month**, not cash received in that month. A payment on 28 Oct for an invoice issued 15 Oct counts in October, but a payment on 18 Nov for that same invoice would also count in October | `v_monthly_revenue` → `v_operating_surplus` | The "cash basis" surplus is really an invoice-cohort basis |
| F4 | No app path raises an invoice for a **programme booking**. The seed writes programme invoice lines directly | programmes module | Programme revenue never reaches billing unless an admin adds it by hand |
| F5 | **One-on-one** (`per_block`, `per_hour`) packages are never billed by the monthly run, and there is no RPC to bill them. The seed invoices Karabo's block by hand | `run_monthly_invoices` (monthly only) | Easy to miss revenue |
| F6 | `contact_enquiries.status` has no `converted` (the plan uses it); enrolment decline is `declined`, not `ended`; consent codes differ from the plan | E2E-TEST-PLAN.md | Plan wording only; fix the plan |
| F7 | `learners.joined_on` defaults to the **submission** date for prospective learners, which feeds F2 | `submit_enrolment` | Combine with F2 |

---

## 7. Execution log

Copy this section into your run record. Use Pass / Fail / Blocked / N/A. For every Fail, link a screenshot or a query result and a defect ID.

**Run:** ______ **Build/commit:** ______ **Seeded at:** ______ **Testers:** ______

| Test ID | Status | Tester | Date | Evidence / notes | Defect |
| :--- | :---: | :--- | :--- | :--- | :--- |
| TC-AUTO-01 … 09 | | | | | |
| TC-PUB-01 | | | | | |
| TC-PUB-02 | | | | | |
| TC-PUB-03 | | | | | |
| TC-PUB-04 | | | | | |
| TC-PUB-05 | | | | | |
| TC-PUB-06 | | | | | |
| TC-PUB-07 | | | | | |
| TC-AUTH-01 | | | | | |
| TC-AUTH-02 | | | | | |
| TC-AUTH-03 | | | | | |
| TC-AUTH-04 | | | | | |
| TC-AUTH-05 | | | | | |
| TC-AUTH-06 | | | | | |
| TC-AUTH-07 | | | | | |
| Deactivated login (Annelie) | | | | | |
| TC-ADM-01 | | | | | |
| TC-ADM-02 | | | | | |
| TC-ADM-03 | | | | | |
| TC-ADM-04 (adjusted) | | | | | |
| TC-ADM-05 | | | | | |
| TC-ADM-06 (adjusted) | | | | | |
| TC-ENR-01 | | | | | |
| TC-ENR-02 | | | | | |
| TC-ENR-03 | | | | | |
| TC-ENR-04 | | | | | |
| TC-ENR-05 | | | | | |
| TC-ENR-06 (adjusted) | | | | | |
| TC-ATT-01 | | | | | |
| TC-ATT-02 | | | | | |
| TC-ATT-03 | | | | | |
| TC-ATT-04 | | | | | |
| TC-ACAD-01 | | | | | |
| TC-ACAD-02 | | | | | |
| TC-ACAD-03 | | | | | |
| TC-ACAD-04 | | | | | |
| TC-ACAD-05 | | | | | |
| TC-ACAD-06 | | | | | |
| TC-BILL-01 | | | | | |
| TC-BILL-02 | | | | | |
| TC-BILL-03 | | | | | |
| TC-BILL-04 | | | | | |
| TC-BILL-05 | | | | | |
| TC-BILL-06 | | | | | |
| TC-OPS-01 | | | | | |
| TC-OPS-02 | | | | | |
| TC-OPS-03 | | | | | |
| TC-OPS-04 | | | | | |
| TC-OPS-05 | | | | | |
| TC-OPS-06 | | | | | |
| TC-SEC-01 | | | | | |
| TC-SEC-02 | | | | | |
| TC-SEC-03 | | | | | |
| TC-SEC-04 | | | | | |
| TC-SEC-05 | | | | | |

**Sign-off:** fill in the AC-01 – AC-16 matrix in [`E2E-TEST-PLAN.md` §12](E2E-TEST-PLAN.md) from the results above.
