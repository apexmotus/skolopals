# Phase 3a — Reference, People, Tutors

First feature slice. Everything downstream (enrolment, timetable, billing, assessment,
communication) references learners, guardians or tutors, so this slice must land first and be
genuinely solid — a bug in `can_view_learner`/`tutor_teaches` here propagates into every later
module's authorization.

Build order within this slice: **`reference` → `people` → `tutors`** (tutors' competencies
reference `subject_offerings` from `reference`; `people`'s learners reference `grades` from
`reference`).

## Modules, endpoints, business rules, SPs

All three already fully specified:
- Endpoints + business rules: `03-endpoints-and-business-rules.md` §`reference`, §`people`,
  §`tutors`.
- SPs: `02-sp-catalogue.md` "People / safeguarding" and "Tutors" sections, plus the `reference`
  module's CRUD index rows.
- Authorization: nothing to build here. The `private.can_view_learner`/
  `private.can_view_learner_private` helper functions and the RLS policies that call them
  already exist and are kept live (`04-phase0-schema-port-and-cutover-strategy.md` §1) — this
  slice's job is proving they still behave correctly through the API's new connection pattern
  (see the test requirement below), not re-implementing them.

## Tasks specific to this slice (beyond the generic module recipe, generic spec §9)

1. For each `reference` table: Rows, Repository (`List`/`Create`/`Update` per generic spec §9
   step 1–2), DTOs, Mapper, Manager (admin-write/public-read per
   `03-endpoints-and-business-rules.md`), Controller, Module, tests. These are the simplest
   modules in the whole system — use one of them (`school_phases` or `grades`) as the literal
   template the rest of this slice (and arguably the rest of the project) copies, the way
   generic spec §9.1 uses `customers` as its own template.
2. `people` module: build `/people/me` reading `auth.users` + `public.profiles` exactly as they
   exist today — **no merge, no new table**; that merge only existed under the earlier
   self-hosted-auth plan and does not apply now that Supabase Auth is kept (Phase 0 §2). Then
   `learners`, `learner_guardians`, safeguarding tables, exactly per the endpoint table. **Write
   the e2e tests proving `can_view_learner`/`can_view_learner_private` actually restrict results
   through the API's new direct-Postgres connection before writing anything else in this
   module** — these are the policies every later phase's "actor-scoped" endpoints lean on; get
   this proof in early (building on the Phase 1 spike) so a regression in the connection pattern
   is caught at the source, not three modules later when a tutor endpoint unexpectedly leaks
   medical notes through a join.
3. `tutors` module: consume the `FileStorageService` built in Phase 1
   (`common/file-storage/`, wrapping Supabase Storage's existing `tutor-documents` bucket — per
   Phase 0 §3) for document upload/download; this module is its first and only consumer, but
   the service itself was already built generically in Phase 1. `uploadDocument` calls
   `FileStorageService.createSignedUploadUrl()` and returns it to the admin caller rather than
   proxying the file bytes through the API; `listDocuments`/download use
   `createSignedUrl()` for read access. Wire the 50 MB / `image/jpeg,image/png,application/pdf`
   limit at the controller (class-validator on the DTO plus a Fastify multipart size limit if
   bytes do pass through for any reason), not just documented — the Supabase bucket enforces this
   at the storage layer too, but the API must not rely on that alone.
4. Reference data: grades, subjects, subject_offerings, languages, achievement_levels,
   consent_types — these already exist as real rows in the live/dev Supabase database (no
   seed file to apply; Phase 0 produces no DDL or seed script under the Postgres/Supabase
   plan). Confirm the actual dev/test Supabase project or branch this slice's e2e fixtures run
   against has this reference data present and correct before relying on it — if it's missing
   or stale, that's a data-entry task against the real database, not a plan-file change.

## Verify

- `pnpm lint && pnpm test && pnpm test:e2e` pass for `reference`, `people`, `tutors`.
- Every endpoint in `03-endpoints-and-business-rules.md` for these three modules exists with
  the specified method/path/roles/DTOs; Swagger renders all of them.
- Manager unit tests explicitly cover: a `Tutor` actor denied medical notes/collectors/
  emergency-contacts even when they teach the learner (the POPIA boundary — generic spec §10's
  coverage requirement, called out again because it's the one that must never regress); a
  `Parent` actor denied another family's learner; a `Tutor` actor granted a learner's
  non-private data (assessments etc. — covered properly in Phase 3c, but the visibility
  *policy* itself is proven here, first, through the API's connection).
- Repository unit tests assert exact SP name/parameter types/lengths for every method, per
  generic spec §10 — this is what catches an SP signature drift against `02-sp-catalogue.md`
  before it reaches a human reviewer.
