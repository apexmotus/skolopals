# Business Requirements Specification
## Skolopals Tutoring Centre — Learner Management & Centre Platform

| | |
| --- | --- |
| **Document** | BRS-SKP-2026-001 |
| **Version** | 1.0 — Draft for approval |
| **Date** | 2026-10-20 |
| **Author** | Prepared with Claude Code |
| **Business owner** | Winnie Thobela, Owner & Centre Manager |
| **Status** | Awaiting business sign-off (§14) |

### Source documents

| Ref | Document | Role in this BRS |
| --- | --- | --- |
| **BP** | `Skolopals_Tutoring_Centre_Detailed_Business_Plan_2026_2030.docx` | **Primary source of business need.** Requirements trace to its sections |
| **IS** | `docs/SPEC-2026-centre-rebuild.md` | Implementation specification — the technical answer to this BRS |
| **PP** | `docs/POPIA-policy.md` | Compliance requirements |
| **RFQ** | `RFQ Website Skolopals – RAND CONSORTIUM` (NWBRT/2026/10) | **Historical.** Scope of the delivered website; superseded — see §2.3 |
| **AS-IS** | the delivered app, now in `web/` | Current state |

### Revision history

| Ver | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-20 | Initial issue |

---

## 1. Executive summary

Skolopals Tutoring Centre is an after-school education support centre at 10 Plumbago Street, Damonsville, Brits, North West. The business plan sets a path from 30–50 learners in Year 1 to multiple branches and an online academy by Year 5.

A website was delivered in 2026 under RFQ NWBRT/2026/10. It implements an **online tutoring marketplace** — learners browse tutors, book lessons by the hour, and pay by card, with Skolopals retaining 40%. The business plan describes something materially different: a **physical centre selling monthly packages**, where the centre allocates tutors, runs a fixed timetable, assesses learners, reports termly to parents, and invoices families.

This BRS specifies the business requirements for the platform Skolopals actually needs. It supersedes the RFQ scope (§2.3) and is the basis for the implementation specification in `IS`.

**The headline requirement:** replace per-lesson marketplace transactions with **monthly package enrolment, timetabled group teaching, measured learner progress, and invoiced family accounts** — the value chain the business plan calls Assessment → Learning Plan → Tutoring → Homework → Testing → Progress Report → Parent Feedback.

---

## 2. Business context

### 2.1 The business

| | |
| --- | --- |
| Trading name | Skolopals Tutoring Centre |
| Location | 10 Plumbago Street, Damonsville, Brits, North West |
| Market | Grade R–12 learners in Damonsville, Brits and surrounding communities |
| Curriculum | CAPS (South African national curriculum) |
| Operating hours | Mon–Thu 13:00–18:00 · Fri admin, tests, parent meetings · Sat 08:00–13:00 |
| Vision | *"Learning Today. Succeeding Tomorrow."* |

### 2.2 Current state (AS-IS)

The delivered website is a functioning Next.js and Supabase application providing: public marketing pages, tutor search with filters, tutor profiles with ratings, a three-step lesson booking flow with simulated card payment, student/tutor/admin dashboards, a public tutor application and an admin approval workflow.

**Gaps against the business plan:**

| # | Gap | BP ref |
| --- | --- | --- |
| G-01 | No concept of a parent or guardian paying for several children | §6 |
| G-02 | No monthly packages — only per-hour pricing | §9 |
| G-03 | Prices in US dollars; times in Europe/London | §9 |
| G-04 | Grades are GCSE and A-Level, not CAPS Grade R–12 | §5 |
| G-05 | No fixed weekly timetable or group classes | §11 |
| G-06 | No attendance register | §12, §24 |
| G-07 | No safeguarding — emergency contacts, controlled collection | §22 |
| G-08 | No initial assessment, learning plan or termly report | §12 |
| G-09 | No invoicing, statements, receipts or late fees | §20 |
| G-10 | Tutors paid a 40/60 revenue share, not as centre staff | §13, §17 |
| G-11 | No holiday or Saturday programmes | §5, §23 |
| G-12 | No KPI reporting; no expense capture, so no operating surplus | §17, §24 |
| G-13 | No POPIA compliance — the system holds children's data | Legal |

### 2.3 Relationship to RFQ NWBRT/2026/10

**Decision (2026-10-20, Business Owner): the RFQ is delivered and closed. The business plan supersedes it. This BRS takes precedence over the RFQ scope.**

The RFQ is retained here as traceability — it explains the shape of the existing code — and because several RFQ items sit outside this platform and remain live operational commitments.

| RFQ §3 item | Disposition |
| --- | --- |
| 1. Website — marketplace features | **Superseded.** Replaced by the centre model in §6 |
| — Become a Tutor page + application | **Withdrawn.** Tutor onboarding is admin-only (BR-23) |
| — Admin Tutor Approval System | **Withdrawn** with the above |
| — Booking page with card payment | **Withdrawn.** Invoice-based billing (BR-42) |
| — 40% platform fee, weekly tutor payouts | **Withdrawn.** Tutors are centre staff (BR-26) |
| — Price filter, hourly rate on profile | **Changed.** Package pricing (BR-12) |
| — Free trials and discounts | **Withdrawn.** No discounts (BR-15) |
| — Student/Tutor dashboards, messaging, resources | **Retained**, re-scoped to parent/learner/tutor |
| — Tutor profiles, ratings, reviews | **Retained** (BR-24, BR-25) |
| — Contact page, footer, privacy, terms | **Retained**, content rewritten (BR-55, BR-67) |
| 2. Training and mentorship | **Live commitment — out of scope for this BRS.** See §11 |
| 3. Domain registration | **Live commitment — out of scope.** See §11 |
| 4. Hosting for 12 months | **Live commitment — out of scope.** See §11 |
| 5. Google My Business listing | **Live commitment — out of scope.** See §11 |
| 6. SEO, five keywords for six months | **Live commitment — out of scope.** See §11 |
| 7. Social media linking and training | **Live commitment — out of scope.** See §11 |

> ⚠️ **Risk flagged.** This BRS removes features the RFQ expressly specified. The owner has confirmed the RFQ is closed, so no variation is sought. If any part of that engagement is in fact still open, or if payment is outstanding against delivery of the RFQ scope, **R-01 in §12 applies and this decision must be revisited before Phase 3 of the build removes those features.**

---

## 3. Business objectives and success criteria

Traced to BP §4 and §24.

| Ref | Objective | Success criterion | BP ref |
| --- | --- | --- | --- |
| OBJ-1 | Enrol and retain 30–50 learners in Year 1 | Platform supports enrolment, placement and billing for 50 learners without manual workaround | §4, §23 |
| OBJ-2 | Make learner progress measurable | Every active learner has an initial assessment, a learning plan and a termly report | §12 |
| OBJ-3 | Collect fees reliably | Outstanding fees visible at all times; late fees applied automatically; statements available on demand | §20, §24 |
| OBJ-4 | Reach break-even at ~30 learners | Revenue, expenses and operating surplus reportable monthly from system data | §19, §24 |
| OBJ-5 | Keep children safe on the premises | Every in-centre session has a register; every learner has emergency contacts and authorised collectors | §22 |
| OBJ-6 | Strengthen parent communication as the differentiator | Parents can see attendance, assessments, reports and account from their own login | §10 |
| OBJ-7 | Be ready for online tutoring by Year 3 without rework | Delivery mode supported from day one | §23 |
| OBJ-8 | Process children's data lawfully | POPIA compliance per `PP`; Information Officer registered | Legal |

---

## 4. Stakeholders

| Stakeholder | Interest | Key needs |
| --- | --- | --- |
| **Owner / Centre Manager** (Winnie Thobela) | Runs the business; Information Officer | KPIs, cash position, enrolment pipeline, staff oversight |
| **Parents / Guardians** | Pay fees; want measurable improvement | Enrol easily, see progress, understand the bill, reach the tutor |
| **Learners (Grade R–12)** | Receive tutoring | Know when and where classes are; see their own progress |
| **Tutors** | Teach and are paid by the centre | Timetable, registers, assessment capture, sessions taught |
| **Administrator** (Phase 2 staffing) | Daily operations | Invoice runs, payment recording, placement, enquiries |
| **Information Regulator** | POPIA enforcement | Lawful processing of children's data |
| **SARS** | Tax compliance | 5-year financial records |

---

## 5. Scope

### 5.1 In scope

Parent and learner accounts · learner records and safeguarding · monthly package enrolment · tutor staff management · term timetable and recurring classes · attendance registers · the full assessment-to-report cycle · invoicing, payments, statements and receipts · holiday and Saturday programmes · messaging · tutor profiles with moderated reviews · admin KPI dashboard · expense capture · public marketing site · POPIA compliance · normalised database (4NF) runnable locally.

### 5.2 Out of scope

| Excluded | Reason |
| --- | --- |
| Online card payment gateway | Business decision — invoice and record only (BR-42) |
| Referral programme (BP §14) | Deferred; schema leaves room |
| Multi-branch / second location (BP §23 Year 4) | Future phase |
| Online academy and digital resource sales (BP §23 Year 5) | Future phase |
| Payroll processing | Pay rates recorded; payroll runs outside the system |
| Accounting system integration | Expenses captured for KPIs only |
| RFQ items 2–7 (domain, hosting, SEO, GMB, social, training) | Operational commitments, not platform requirements — §11 |

---

## 6. Future state — the business model

### 6.1 Operating model (BP §11)

| Day | Use |
| --- | --- |
| Mon–Thu | 13:00–18:00, sessions by grade and subject |
| Fri | Tests, catch-up, parent meetings, administration |
| Sat | 08:00–13:00, exam prep, Mathematics, languages, high-school subjects |

### 6.2 Core value chain (BP §10)

```
Assessment → Individual Learning Plan → Tutoring → Homework support
          → Testing → Progress Report → Parent Feedback
```

Every stage must be a recorded, retrievable step in the system — this chain *is* the product differentiator the plan sells.

### 6.3 Pricing (BP §9)

| Service | Price | Billing |
| --- | --- | --- |
| Group – 1 subject | R450 | monthly |
| Group – 2 subjects | R750 | monthly |
| Group – 3 subjects | R950 | monthly |
| All-subject support | R1,100 | monthly |
| Homework assistance | R500 | monthly |
| Academic Plus | R1,250 | monthly |
| One-on-one – 1 hour | R180 | per hour |
| One-on-one – 4 lessons | R650 | per block |
| Registration | R150 | once-off |
| Holiday programme | R350–R750 | per programme |

**No discounts.** The tiers are the whole price list.

---

## 7. Business requirements

Priority: **M** = Must (Year 1 viability) · **S** = Should · **C** = Could.

### 7.1 Accounts and people

| Ref | Requirement | Pri | BP |
| --- | --- | --- | --- |
| BR-01 | A parent/guardian shall hold one account and register one or more learners under it | M | §6 |
| BR-02 | A learner shall be a record, not necessarily a login; a guardian may optionally issue an older learner their own login | M | §6 |
| BR-03 | A learner shall be linkable to more than one guardian, with one marked as the billing contact | M | §6 |
| BR-04 | A person shall be able to hold more than one role (e.g. parent and tutor) | S | — |
| BR-05 | A learner record shall capture full name, date of birth, CAPS grade, school attended and home language | M | §5, §6 |
| BR-06 | Each learner shall have at least one emergency contact before attending | M | §22 |
| BR-07 | Each learner shall have a list of persons authorised to collect them | M | §22 |
| BR-08 | Medical and allergy information shall be recordable and visible only to the centre manager and administrators | M | §22 |

### 7.2 Enrolment and packages

| Ref | Requirement | Pri | BP |
| --- | --- | --- | --- |
| BR-09 | A parent shall select a package, register the learner's details and submit an enrolment request online | M | §9 |
| BR-10 | A parent shall be able to nominate a preferred tutor; the centre confirms or reassigns | M | §10 |
| BR-11 | A parent shall select which subjects fill the package allowance, and the medium of instruction for each | M | §5 |
| BR-12 | Package prices shall be held with effective dates so prices can change without rewriting history | M | §9 |
| BR-13 | An administrator shall review, approve, assign a tutor and place the learner into classes | M | §11 |
| BR-14 | One-on-one hours, holiday programmes and exam prep shall be addable to an existing enrolment | M | §5, §9 |
| BR-15 | No automatic discount shall apply; an administrator may record an ad hoc credit | M | §9 |
| BR-16 | Enrolments shall support pending, active, paused and ended states | M | — |

### 7.3 Curriculum and tutors

| Ref | Requirement | Pri | BP |
| --- | --- | --- | --- |
| BR-17 | The system shall use CAPS: Grade R–12 within Foundation, Intermediate, Senior and FET phases | M | §5 |
| BR-18 | Subjects shall be recorded per the plan's lists, offered per grade | M | §5 |
| BR-19 | A tutor's teaching ability shall be recorded as subject **and** grade together, not independently | M | §13 |
| BR-20 | Medium of instruction shall be recorded against each teaching ability — a tutor may teach Physical Sciences in Afrikaans and Mathematics in English | M | §5 |
| BR-21 | Languages a tutor speaks for parent communication shall be recorded separately from medium of instruction | S | §14 |
| BR-22 | Tutor qualifications, references, identity documents and police clearance shall be recorded, with verification status | M | §13 |
| BR-23 | **Only an administrator shall create a tutor.** No public tutor application | M | §13 |
| BR-24 | Tutor profiles shall be publicly viewable as a staff directory, without prices | M | §10 |
| BR-25 | Parents shall be able to rate and review a tutor; reviews are published only after moderation | S | §10 |
| BR-26 | Tutors shall be paid as centre staff, on a monthly salary or a per-session rate, with effective dates | M | §13, §17 |

### 7.4 Timetable, attendance and safeguarding

| Ref | Requirement | Pri | BP |
| --- | --- | --- | --- |
| BR-27 | Teaching shall be organised as recurring weekly classes with a subject, medium, grade range, tutor, capacity and room | M | §11 |
| BR-28 | Class times shall be validated against centre operating hours | S | §11 |
| BR-29 | Each class occurrence shall generate an attendance register marked present, absent, late or excused | M | §12, §24 |
| BR-30 | Every class shall be flagged in-centre, online or hybrid; online occurrences carry a per-session meeting link | M | §23 |
| BR-31 | A substitute tutor shall be recordable against a single occurrence | S | §22 |
| BR-32 | In-centre sessions shall record arrival and collection, with the collector matched against the authorised list | M | §22 |
| BR-33 | One-on-one tuition shall use the same timetable mechanism, as a class of capacity one | M | §9 |
| BR-34 | Holiday and Saturday programmes shall be definable with their own dates, capacity and price | S | §5, §23 |

### 7.5 Assessment and progress

| Ref | Requirement | Pri | BP |
| --- | --- | --- | --- |
| BR-35 | Every new learner shall complete an initial assessment covering reading, spelling, comprehension, writing, Mathematics and language | M | §12 |
| BR-36 | Assessment results shall be captured per domain, not as a single free-text score | M | §12 |
| BR-37 | Achievement shall use the CAPS 7-point scale | M | §12 |
| BR-38 | An individual learning plan with per-subject goals and target levels shall follow the initial assessment | M | §10, §12 |
| BR-39 | Monthly monitoring shall record a short assessment, tutor comments, attendance and homework | M | §12 |
| BR-40 | A termly report shall identify, per subject, strengths, areas for improvement and recommended intervention | M | §12 |
| BR-41 | Parents shall be able to read and acknowledge a termly report, with a comment | M | §10, §12 |

### 7.6 Billing

| Ref | Requirement | Pri | BP |
| --- | --- | --- | --- |
| BR-42 | Fees shall be invoiced and recorded. **No online card payment** | M | §20 |
| BR-43 | Invoices shall be numbered `SKP-YYYY-NNNN`, resetting annually | M | §20 |
| BR-44 | Invoices shall be issued on the 15th of the preceding month and fall due on the 1st | M | §20 |
| BR-45 | A R150 late fee shall apply 3 days after the due date | M | §20 |
| BR-46 | On enrolment, the R150 registration fee shall be invoiced immediately; tuition joins the normal cycle | M | §9, §20 |
| BR-47 | An administrator shall set the first-month amount per enrolment, with the reason recorded | M | §20 |
| BR-48 | A single payment shall be allocatable across several invoices, and an invoice settled by several payments | M | §20 |
| BR-49 | Parents shall access a statement of account showing invoices, payments, credits and balance | M | §20 |
| BR-50 | A receipt shall be available for every recorded payment | M | §20 |
| BR-51 | All amounts shall be in South African Rand; all times in Africa/Johannesburg | M | §9 |

### 7.7 Communication

| Ref | Requirement | Pri | BP |
| --- | --- | --- | --- |
| BR-52 | Parents, tutors and administrators shall exchange messages in the platform, optionally about a named learner | M | §10 |
| BR-53 | Read state shall be tracked per participant | S | — |
| BR-54 | Administrators shall publish announcements to a chosen audience | S | §14 |
| BR-55 | Public enquiries shall be captured with a status and source, feeding the enquiry KPI | M | §24 |
| BR-56 | Tutors shall share resources with a learner, a class, a grade or everyone | S | §5 |

### 7.8 Management information

| Ref | Requirement | Pri | BP |
| --- | --- | --- | --- |
| BR-57 | Financial KPIs: monthly revenue, expenses, operating surplus, outstanding fees, revenue per learner | M | §24 |
| BR-58 | Academic KPIs: attendance rate, assessment results, reading improvement, test and exam results | M | §24 |
| BR-59 | Business KPIs: new learners, returning learners, retention, enquiries | M | §24 |
| BR-60 | Operating expenses shall be recordable by category so operating surplus is computed, not estimated | M | §17, §19 |
| BR-61 | Break-even shall be reportable against actual cost and average revenue per learner | S | §19 |

### 7.9 Public site

| Ref | Requirement | Pri | BP |
| --- | --- | --- | --- |
| BR-62 | The site shall present Skolopals as a Damonsville/Brits community centre, including the value chain | M | §1, §10 |
| BR-63 | The pricing page shall show the package table in Rand | M | §9 |
| BR-64 | Subjects shall be presented grouped by CAPS phase | M | §5 |
| BR-65 | Operating hours and the term timetable shall be published | S | §11 |
| BR-66 | Holiday and Saturday programmes shall be published with dates and prices | S | §5 |
| BR-67 | Privacy content shall be the POPIA notice in `PP` | M | Legal |

---

## 8. Non-functional requirements

| Ref | Requirement | Measure |
| --- | --- | --- |
| NFR-01 | **Usable on a phone.** WhatsApp and Facebook are the plan's main channels (BP §14), so most parents will arrive on mobile | All parent journeys complete on a 360px viewport |
| NFR-02 | **Low bandwidth tolerance** | Key pages usable on a 3G connection |
| NFR-03 | **Capacity** | 200 learners, 10 tutors, 5 years of history without redesign |
| NFR-04 | **Availability** | Best-effort; no formal SLA at this scale |
| NFR-05 | **Access control enforced in the database**, not only in screens | Row-level security on every table; verified per role |
| NFR-06 | **Audit trail** on registers, payments, published reports and discretionary amounts | Actor and timestamp stored |
| NFR-07 | **Data normalised to 4NF** | Documented audit; no multivalued attribute in any table |
| NFR-08 | **Runnable locally** by the maintainer without Docker | Documented command sequence succeeds on a clean machine |
| NFR-09 | **POPIA compliant** | Per `PP`, including consent capture and enforced retention |
| NFR-10 | **5-year retention**, then deletion or anonymisation | Automated, with administrator confirmation |
| NFR-11 | **Backups** with a tested restore | Restore rehearsed before go-live |
| NFR-12 | **English interface**, with Afrikaans and Setswana considered later | — |

---

## 9. Data requirements

| Ref | Requirement |
| --- | --- |
| DR-01 | A learner's grade shall determine its CAPS phase — phase is never stored separately |
| DR-02 | Teaching ability is the combination of tutor, subject and grade; medium of instruction attaches to that combination |
| DR-03 | Prices, pay rates and billing settings are time-bounded, never overwritten |
| DR-04 | Monetary values stored as integer cents in ZAR |
| DR-05 | Timestamps stored with time zone; displayed in Africa/Johannesburg |
| DR-06 | Derived values (ratings, balances, KPIs) computed from source, not duplicated as stored fields |
| DR-07 | Deleting a learner shall not destroy financial history needed for tax or KPI continuity |
| DR-08 | Consent recorded per purpose, with the policy version, and withdrawable |
| DR-09 | The database shall be the single source of truth, held in `db/` |

---

## 10. Assumptions, constraints and dependencies

### Assumptions

| Ref | Assumption | If wrong |
| --- | --- | --- |
| A-01 | RFQ NWBRT/2026/10 is delivered and closed | §2.3 decision reopens; see R-01 |
| A-02 | Parents have a smartphone and WhatsApp | Offline paper fallback needed throughout |
| A-03 | Fees are paid by EFT or cash, recorded by an administrator | Gateway integration becomes in scope |
| A-04 | The centre operates from one location in Year 1 | Multi-site model needed earlier than Year 4 |
| A-05 | Tutors can be trained to mark registers and capture assessments | Admin captures on their behalf; more admin load |
| A-06 | Learner numbers stay under 200 for the period | Re-assess capacity and hosting |

### Constraints

| Ref | Constraint |
| --- | --- |
| C-01 | Start-up budget R45,500; monthly operating budget R22,000 (BP §16, §17) — no material new spend |
| C-02 | Phase 1 staffing is the owner plus 1–2 tutors; the platform must not assume dedicated admin |
| C-03 | Data hosted in London; children's data leaves South Africa under POPIA s72 (`PP` B3) |
| C-04 | Development machine has no Docker — local database must run on Homebrew Postgres |
| C-05 | Existing stack is Next.js and Supabase; no re-platforming |

### Dependencies

| Ref | Dependency | Owner | Needed by |
| --- | --- | --- | --- |
| D-01 | Confirmed 2026 SA school term dates | Business | Before go-live |
| D-02 | Information Officer registered with the Information Regulator | Business | Before go-live |
| D-03 | Attorney review of the POPIA notice | Business | Before publication |
| D-04 | PAIA manual | Business | Before go-live |
| D-05 | Business email address for data subject requests | Business | Before publication |
| D-06 | Registered business name and registration number | Business | Before publication |
| D-07 | Supabase and Vercel data processing agreements accepted and filed | Business | Before go-live |
| D-08 | Tutor pay rates agreed | Business | Phase 1 |
| D-09 | Email/WhatsApp provider for invoices and reminders | Business | Phase 6 |

---

## 11. RFQ operational commitments (out of scope, tracked)

Recorded so they are not lost when the platform work proceeds.

| RFQ item | Status |
| --- | --- |
| Training and mentorship on using and updating the site | Not addressed by this BRS — confirm delivered or schedule |
| Domain registration | Confirm registered and in the owner's name |
| Hosting for 12 months | Confirm start date and renewal |
| Google My Business listing | Confirm live — material for a local community business |
| SEO, five keywords for six months | Confirm period and whether it has lapsed |
| Social media linking and content training | Confirm delivered |

> These support BP §14's marketing strategy. If the 12-month hosting or SEO period has lapsed, renewal is a business decision with a cost the plan's R1,000/month marketing line must absorb.

---

## 12. Risks

| Ref | Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- | --- |
| **R-01** | **RFQ obligations are in fact still open, and this BRS removes specified features** | **High** | Low | Owner has confirmed closure (§2.3). Re-verify before Phase 3 removes RFQ features — that is the point of no return |
| R-02 | POPIA breach involving children's data | High — up to R10m and criminal liability | Low | `PP` in full: consent, admin-only sensitive data, retention, breach procedure |
| R-03 | Information Officer not registered at go-live | High — immediate non-compliance | Medium | D-02 blocks go-live |
| R-04 | Non-payment of fees (BP §22's top risk) | High | Medium | Invoice in advance, 3-day grace, late fee, visible outstanding balance, statements |
| R-05 | Mid-month joiners receive a large three-period first invoice | Medium | Medium | `IS` §9.3 — admin may zero the first month or invoice off-cycle |
| R-06 | Rebuild is wider than expected; business left without a working site | High | Medium | Phased delivery, working build at each gate |
| R-07 | Tutors do not adopt registers and assessment capture | Medium — KPIs become unreliable | Medium | Simple mobile-first register; admin fallback; training (A-05) |
| R-08 | Single-person dependency — owner is manager, admin and Information Officer | Medium | High | Deputy at Phase 2 staffing; documented procedures |
| R-09 | Local Postgres differs from Supabase, hiding defects until deploy | Medium | Medium | Supabase CLI parity check before each deploy |
| R-10 | Term dates not loaded, so termly reports cannot be produced | Medium | Medium | D-01 blocks go-live |

---

## 13. Acceptance criteria

The platform is accepted when a complete business cycle can be demonstrated on real data.

| # | Scenario | Evidence |
| --- | --- | --- |
| AC-01 | A parent enrols a child in *Group – 2 subjects*, nominates a preferred tutor and records emergency contacts and authorised collectors | Enrolment appears in the admin queue with all data |
| AC-02 | An administrator approves it, assigns a tutor and places the learner into two weekly classes | Learner appears on both class registers |
| AC-03 | The R150 registration fee is invoiced immediately as `SKP-2026-NNNN` | Invoice visible to the parent |
| AC-04 | A tutor marks a register on a phone, including a late arrival | Attendance visible to the parent same day |
| AC-05 | A tutor records an initial assessment across all six domains and produces a learning plan with per-subject goals | Parent can view both |
| AC-06 | A termly report is issued per subject and the parent acknowledges it with a comment | Acknowledgement stored against the report |
| AC-07 | The 15th invoice run bills every active enrolment for the following month | Invoice count matches active enrolments |
| AC-08 | A R1,900 payment is recorded against three invoices across two children | Allocations correct; balance zero |
| AC-09 | An unpaid invoice attracts a R150 late fee on day 4 | Fee appears on the next invoice |
| AC-10 | A parent downloads a statement and a receipt | Both reconcile to the account |
| AC-11 | The admin dashboard reports revenue, expenses, surplus, outstanding fees, attendance rate and retention | Figures reconcile to source |
| AC-12 | A parent sees only their own children; a tutor sees only their classes and no billing; a learner login sees only itself | Verified per role at database level |
| AC-13 | Enrolment cannot complete without the s35 guardian consent; optional consents default to off and do not block | Consent records stored with policy version |
| AC-14 | A learner past retention is listed for purge and deleted only on administrator confirmation | Purge log entry |
| AC-15 | The database runs from clean on the maintainer's machine without Docker | Documented commands succeed |
| AC-16 | An online class carries a per-session meeting link visible to enrolled parents only | Link renders on the timetable |

---

## 14. Approval

| Role | Name | Approves | Date |
| --- | --- | --- | --- |
| Business Owner / Information Officer | Winnie Thobela | Business requirements §3–§9, scope §5, RFQ supersession §2.3 | |
| Technical | — | Non-functional §8, data §9, implementation per `IS` | |
| Legal | — | POPIA position per `PP` | |

**Before sign-off, confirm:** the §2.3 RFQ decision; the §10 dependencies, particularly D-01 and D-02 which block go-live; and the §12 R-01 position.

---

## Appendix A — Traceability: business plan → requirements

| BP § | Topic | Requirements |
| --- | --- | --- |
| §4 | Business objectives | OBJ-1 … OBJ-8 |
| §5 | Services offered | BR-11, BR-14, BR-17, BR-18, BR-34, BR-56, BR-64, BR-66 |
| §6 | Target market | BR-01 … BR-05 |
| §9 | Recommended pricing | BR-09, BR-12, BR-15, BR-33, BR-46, BR-51, BR-63 |
| §10 | Unique selling proposition | BR-10, BR-24, BR-25, BR-38, BR-41, BR-52, BR-62 |
| §11 | Operating model | BR-13, BR-27, BR-28, BR-65 |
| §12 | Assessment and progress | BR-29, BR-35 … BR-41 |
| §13 | Staffing plan | BR-19, BR-22, BR-23, BR-26 |
| §14 | Marketing strategy | BR-21, BR-54, NFR-01, §11 |
| §17 | Monthly operating expenses | BR-26, BR-60 |
| §19 | Break-even analysis | BR-61, OBJ-4 |
| §20 | Payment policy | BR-42 … BR-50 |
| §22 | Risk management | BR-06, BR-07, BR-08, BR-31, BR-32, R-04 |
| §23 | Five-year growth plan | BR-30, BR-34, OBJ-7 |
| §24 | Key performance indicators | BR-29, BR-55, BR-57 … BR-59 |

## Appendix B — Traceability: requirements → implementation

| Requirement group | `IS` section |
| --- | --- |
| BR-01 … BR-08 (people, safeguarding) | §4.2 |
| BR-09 … BR-16 (enrolment, packages) | §4.3, §4.4 |
| BR-17 … BR-26 (curriculum, tutors) | §3.3, §4.1, §4.2 |
| BR-27 … BR-34 (timetable, attendance) | §4.5, §4.6 |
| BR-35 … BR-41 (assessment) | §4.7 |
| BR-42 … BR-51 (billing) | §4.8, §9 |
| BR-52 … BR-56 (communication) | §4.9 |
| BR-57 … BR-61 (management information) | §4.10 |
| BR-62 … BR-67 (public site) | §7.2 |
| NFR-05, NFR-09, NFR-10 | §4.11, `PP` |
| NFR-07 (4NF) | §3 |
| NFR-08 (local) | §6 |

## Appendix C — Glossary

| Term | Meaning |
| --- | --- |
| **CAPS** | Curriculum Assessment Policy Statement — the South African national curriculum |
| **Phase** | CAPS grouping: Foundation (R–3), Intermediate (4–6), Senior (7–9), FET (10–12) |
| **Medium of instruction** | The language a subject is taught in, distinct from the subject itself |
| **Learner** | A child receiving tutoring |
| **Guardian** | The parent or legal guardian holding the account |
| **Package** | A monthly service tier from BP §9 |
| **Class group** | A recurring weekly class learners are enrolled into |
| **Session** | One occurrence of a class group |
| **ILP** | Individual Learning Plan |
| **POPIA** | Protection of Personal Information Act 4 of 2013 |
| **Responsible party** | POPIA term for the entity determining why and how data is processed |
| **Operator** | POPIA term for a third party processing on the responsible party's behalf |
| **4NF** | Fourth normal form |
| **RLS** | Row-level security |
