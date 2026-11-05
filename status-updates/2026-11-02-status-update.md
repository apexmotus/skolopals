# Status Update — Skolopals — 2026-11-02

## Direction
Decisions from the post-report interview:
- **Priority is Phase 8 (deploy to the live Supabase project).** The code is genuinely ready per
  SPEC; next step is pushing the schema, regenerating types against the live project, and
  smoke-testing — then correcting the README's stale phase table.
- **The class-capacity race was fixed immediately** rather than deferred —
  `private.check_class_capacity()` in
  `db/migrations/20261020000006_timetable_attendance.sql` now takes `select ... for update` on
  the `class_groups` row before counting, so two concurrent enrolments into the same near-full
  class serialise instead of both reading the same stale count. Verified with `make reset`: all
  159 assertions still pass, including the existing capacity test, so this is behavior-preserving
  under normal (sequential) use and only changes the outcome under genuine concurrency.
- **The two real names/emails in `db/deploy/01_reset_remote.sql` are the owner's own test
  accounts** — left as-is, no action needed.
- **README's status table corrected.** `README.md`'s Status section now reads phases 0–7 **Done**
  and phase 8 (deploy) **Next**, matching the verified code state instead of the stale snapshot
  from before the rebuild finished. `web/README.md` is a separate, deeper problem — it still
  describes the old marketplace app entirely (booking flow, 40/60 split, `/student` workspace)
  and wasn't touched, since correcting it is a rewrite, not a table edit — flagged for a future
  pass if useful, not actioned here.
- **Multiple admins may use the system concurrently** — confirmed by the user. This is exactly the
  scenario the class-capacity fix above protects against (two admins approving enrolments into the
  same near-full class at the same time), so no further change was needed beyond that fix.
- **POPIA policy exported to PDF** for sharing with the product owner (Winnie Thobela):
  `docs/POPIA-policy.pdf`, generated from `docs/POPIA-policy.md` with tables rendered as real
  tables and the draft/warning callouts and `[TO CONFIRM]` placeholders kept visually distinct.
  The underlying attorney-review / `[TO CONFIRM]` fields themselves are still open — the PDF makes
  them easier to hand off, it doesn't resolve them.

## Summary
Skolopals is a Next.js 16 / React 19 / Supabase app for a physical tutoring centre in
Damonsville, Brits (CAPS curriculum, Grade R–12, monthly package billing in ZAR). The project is
mid-rebuild: the originally delivered site was an hourly-lesson marketplace, and the business
actually runs on monthly packages, a fixed timetable, and invoiced family accounts — so the
database and app were rebuilt from scratch to match. **That rebuild is further along than the
repo's own README admits.** Per the actual code, the database (phases 0–2) and the entire
application (phases 3–7: enrolment, timetable, assessment, billing, public site) are built and
wired to real data — only Phase 8 (deploy to the live Supabase project) remains. The single
biggest technical risk is a concurrency bug that can overbook a class past its capacity; the
single biggest non-technical blocker is that the POPIA privacy policy still has unresolved
contact/registration fields and has not had attorney review, which matters because this system
holds children's personal and health information.

## Architecture
- **Three-sibling layout**: `web/` (app), `db/` (canonical schema — migrations, local dev shim,
  deploy scripts, tests), `docs/` (BRS, implementation spec, POPIA policy). The app's types are
  generated from the database, not the other way around — a sound ordering for a schema-first
  rebuild.
- **Consistent server-side pattern**: `web/src/lib/*.ts` (admin.ts, parent.ts, tutor.ts,
  queries.ts, assessment.ts, messages.ts, centre.ts) are `"server-only"` read modules; mutations
  live in per-route `"use server"` actions.ts files that call either direct inserts or Postgres
  RPCs for anything transactional (invoicing, enrolment activation, assessment scoring). Using
  RPCs for the business-rule-heavy writes, rather than scattering that logic across the app, is
  unusually disciplined for a project this size and will pay off as the rules get more complex.
- **Defense in depth on authorization**: route groups are gated for being signed-in in
  `web/src/proxy.ts`, and every admin/tutor/parent server action additionally calls
  `requireRole(...)` (`web/src/lib/auth.ts:48`) before acting — e.g.
  `admin/enrolments/actions.ts:15`, `admin/billing/actions.ts:14`,
  `tutor/assessments/actions.ts:13`. This is a real backend check layered on top of Postgres RLS,
  not a UI-only gate and not RLS-only.
- **Scalability**: no pagination anywhere yet. `getEnrolmentQueue()`, `getTutors()`, and the
  outstanding-fees views in `web/src/lib/admin.ts` are unbounded; `getEnquiries()` caps at a
  hardcoded `.limit(100)`. Fine at the business plan's Year-1 scale (30–50 learners) — worth
  revisiting well before the plan's later multi-branch/online-academy phase.
- **Database quality**: spot-checked migrations show explicit `on delete` policies on every FK,
  `CHECK` constraints on money/quantity columns, and indices on the FK and date-range columns
  that actually get queried (e.g. `invoices (billing_account_id, issued_on desc)`). RLS is
  enabled on every sensitive table, including `learner_medical_notes` and every billing table,
  and `verify.sh` independently asserts no role bypasses RLS and that tutors see neither billing
  nor medical data.

## Where things stand
- **Database — done, and the "done" claim is credible.** 74 tables, ~19 views, 159 RLS policies
  (SPEC's doc says 75/18/157 — trivial drift, not a red flag). `test-rls.sh` and `test-billing.sh`
  run real fixtures inside `begin;...rollback;` and assert actual values — e.g. invoice numbering
  rolling over `SKP-2026-0001` → `SKP-2027-0001`, a catch-up invoice totalling exactly R1,900
  matching the spec's own worked example, and per-persona row-visibility counts for RLS (guardian
  B gets zero rows of guardian A's data). This is genuine behavioral testing, not "the query
  didn't error."
- **Application — also done, contrary to the README.** Every portal (public, parent, learner,
  tutor, admin) reads and writes real Supabase data; nothing is a hardcoded stub. No
  TODO/FIXME/"not implemented"/"coming soon" exists anywhere in `src/app`, `src/lib`, or
  `src/components`. Concretely: `/enrol` calls RPC `submit_enrolment`
  (`web/src/app/(public)/enrol/actions.ts:69`); the admin enrolment queue approves via RPC
  `activate_enrolment`; the timetable builder inserts class groups/schedules and calls RPC
  `generate_class_sessions`; billing wraps `run_monthly_invoices` / `apply_late_fees` /
  `record_payment`; tutors record assessments and publish termly reports through gated RPCs;
  parents see real invoices, statements, and can acknowledge reports.
- **The README is stale, not the SPEC.** `web/README.md`'s phase table (Phase 4 "Next", 5–8
  blank) was last touched 2026-10-20 19:24 — before the work in `src/lib/{admin,assessment,
  messages,centre,consent}.ts` landed the next day. `docs/SPEC-2026-centre-rebuild.md`'s claim
  that phases 0–7 are done matches the code that exists now. **Only Phase 8 (push the schema to
  the live Supabase project `dhmjzshlznhqohvkdcpz`, regenerate types against it, smoke test) is
  genuinely outstanding.**
- **A non-code blocker sits ahead of any public launch**: `docs/POPIA-policy.md` is explicitly
  marked "Not for publication until the `[TO CONFIRM]` fields are completed and a legal review is
  done" — the Information Officer's business email, the registered business name/number, and the
  Information Regulator registration date are all still placeholders, and the document says
  plainly that an attorney needs to review it before this (a system holding children's health and
  identity data) goes live.

## Risks: things that could fail unexpectedly
Ranked most-severe first.

1. **Class capacity race condition (will bite soon, not theoretical).**
   `db/migrations/20261020000006_timetable_attendance.sql:186-214` enforces class capacity with a
   plain `select count(*) ... where class_group_id = ...` compared against capacity in a trigger
   — no `for update` lock on the class group row, no exclusion/check constraint. Under Postgres's
   default READ COMMITTED isolation, two concurrent enrolment approvals into the same near-full
   class can both read the same stale count, both pass the check, and both commit — overbooking a
   class past capacity. The existing test scripts run fixtures sequentially, so this race is
   untested and wouldn't show up in the "159 assertions passing" figure. This is exactly the kind
   of bug that stays invisible in a demo and shows up the first week two parents enrol their kids
   into the same popular class around the same time. **Fix**: lock the class_groups row (`select
   ... for update`) inside the trigger, or add a serializable check.

2. **Real personal information committed in plaintext to a SQL file.**
   `db/deploy/01_reset_remote.sql:14-20` names two real people by full name and email
   (`mollodagod+stshepana@gmail.com` / "Tshepo Stshepana" and `thyufilus.com@yahoo.com` /
   "Theophilus") in a comment, in a file that's part of the git history. Even if these are your
   own test accounts, it's a habit worth breaking now — this codebase is about to hold real
   children's identity and health data under POPIA, and "real identifiers in committed SQL
   comments" is the kind of pattern that's easy to repeat by accident once it exists once.

3. **No safety gate before an irreversible remote schema reset.**
   `db/deploy/01_reset_remote.sql` runs `begin; ... drop ...; commit;` against the live Supabase
   project with no interactive confirmation, and its own correctness check (`tables_left=0`) only
   runs *after* the commit. Compare the Makefile's local `db-drop` target, which asks `y/N`
   first. Low-frequency risk (you'd run this once, deliberately) but high cost if it's ever run
   against the wrong project or re-run by mistake.

4. **Silent error swallowing on read paths.**
   Dashboard/KPI reads in `web/src/lib/admin.ts` and most of `queries.ts` use
   `data ?? []` / `?? 0` without checking `.error` — a failed Supabase query renders as "zero
   enquiries today" or an empty list rather than a visible error. Write paths (every `actions.ts`)
   do check and surface `.error` correctly; it's specifically the read side that would mask an
   outage or a misconfigured query as "nothing happened" rather than "something's broken."

5. **No pagination.** Covered under Architecture above — not urgent, but will need attention
   before enquiry/tutor history grows past what fits in one unbounded query.

6. **Minor doc drift.** SPEC's "75 tables, 18 views, 157 policies" vs. the actual 74/~19/159.
   Harmless on its own, but it's the same underlying habit as the README phase-table staleness:
   docs not refreshed alongside the code they describe. Worth a quick pass once Phase 8 ships, so
   the numbers that are supposed to be the project's source of truth actually are.

## Security notes
This was a lightweight pass, not a full audit.
- **Good**: RLS is real and behaviorally tested per role (not just "enabled"); server actions add
  a genuine backend authorization check (`requireRole`) on top of RLS rather than relying on RLS
  alone or on the UI; medical notes, tutor documents, and billing tables are correctly locked away
  from the tutor role at the database level.
- **Concerns**: the committed PII in `01_reset_remote.sql` (risk #2) and the missing confirmation
  gate on the remote reset script (risk #3) are the two things worth fixing before this becomes a
  habit rather than a one-off.
- **Flag, not a finding**: the Supabase project region is `eu-west-2` (London), and the project
  processes South African children's personal information — the SPEC document already identifies
  this as a POPIA cross-border transfer question (s72) and says it's "lawful on three independent
  grounds" with consent captured at enrolment. Worth confirming that consent capture is actually
  wired into the live `/enrol` flow (not just documented as a plan) before relying on it.
- For anything deeper than this pass, the `007` or `security-review` skill is the right tool.

## Open questions for you
1. **README vs. SPEC**: now that the code confirms phases 0–7 are actually done, do you want the
   README's status table corrected now, or is that better left until after Phase 8 ships so it's
   updated once rather than twice?
2. **The two real accounts** named in `db/deploy/01_reset_remote.sql` — are those your own test
   accounts, or people you tested with? Either way, is it worth scrubbing that file and rotating
   anything sensitive before this repo has more than one contributor's eyes on it?
3. **POPIA sign-off**: the policy doc is explicitly blocked on an attorney review and three
   `[TO CONFIRM]` fields. Who owns closing that out, and does it need to land before or can it run
   in parallel with the Phase 8 deploy?
4. **The class-capacity race** — is this centre's enrolment process always mediated by one admin
   working serially (in which case the race is unlikely to ever trigger in practice), or could two
   admins/parents plausibly act on the same class at the same time? That changes whether this is
   urgent or just correct-to-fix-eventually.
