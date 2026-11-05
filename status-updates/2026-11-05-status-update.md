# Status Update — Skolopals — 2026-11-05

## Since last update (2026-11-02)
Nothing shipped. `git log` shows no commits since `0ab69a1` (Sun Oct 25) — three days *before*
the last status update even ran. Everything that update's "Direction" section said was done is
actually present in the working tree, but **still only staged, never committed**:

```
git diff --cached --stat
 README.md                                          |   9 +-
 db/migrations/20261020000006_timetable_attendance.sql |   9 +-
 docs/POPIA-policy.pdf                              | Bin 0 -> 239327 bytes
 status-updates/2026-11-02-status-update.md         | 178 +++++++++++++++++++++
```

Verified each piece is actually in the file content (not just staged as a name):
- The capacity-race fix is really in `db/migrations/20261020000006_timetable_attendance.sql` —
  `check_class_capacity()` now does `select capacity into v_capacity from public.class_groups
  where id = new.class_group_id for update` before counting enrolments, exactly as described.
- `README.md`'s status table reads phases 0–7 **Done**, phase 8 **Next**.
- `docs/POPIA-policy.pdf` exists (239 KB).

So the work is real and correct, it's just never been committed. This is new risk #1 below —
three days of good work sitting in the staging area with nothing protecting it.

No other code changed. Phase 8 (deploy) has not progressed: no new migrations beyond
`db/deploy/02_migrations_004_to_023.sql` (last touched Oct 22), no evidence of a push against
the live project, `web/.env.local` still points at a project URL but there's nothing to confirm
schema was pushed since the last check.

## Summary
Skolopals is a Next.js 16 / React 19 / Supabase app for a physical tutoring centre in
Damonsville, Brits (CAPS curriculum, monthly package billing in ZAR). Phases 0–7 (database +
full application) are built and verified; only Phase 8 (deploy to the live Supabase project) is
outstanding, and that hasn't moved in three days. The codebase itself is unchanged since the
last review — same architecture, same risks — except that the one fix made since then (the
class-capacity race) is sitting uncommitted rather than landed.

## Architecture
No changes since 2026-11-02; prior assessment stands:
- Three-sibling layout (`web/`, `db/`, `docs/`), schema-first, types generated from the database.
- Server-side pattern is consistent: `"server-only"` read modules in `web/src/lib/*.ts`,
  mutations in per-route `actions.ts` calling Postgres RPCs for anything transactional.
- Defense in depth: `web/src/proxy.ts` gates signed-in access; every server action additionally
  calls `requireRole()` (`web/src/lib/auth.ts:48`) on top of RLS.
- Still no pagination anywhere (`getEnrolmentQueue()`, `getTutors()`, outstanding-fees views in
  `web/src/lib/admin.ts`) — fine at Year-1 scale, worth revisiting before the plan's later phases.

## Where things stand
- **Database and application: done**, same as 2026-11-02 — 74 tables, RLS tested per role, every
  portal reads/writes real data, no stubs.
- **Phase 8 (deploy): still outstanding, no progress in 3 days.** This is the acknowledged
  priority from the last interview and remains the single blocking step before go-live.
- **The capacity-race fix: correct but uncommitted** (see risk #1).
- **`web/README.md`: still unrewritten.** Still describes the old hourly-booking marketplace
  (`supabase/migrations`, `/student` workspace, tutor earnings/reviews) — unchanged since last
  flagged, not actioned.
- **POPIA policy: unchanged, still blocked.** All three `[TO CONFIRM]` fields (Information
  Officer email/phone, registered business name/number, Information Regulator registration date)
  are still placeholders in `docs/POPIA-policy.md`. The PDF export exists for hand-off, but the
  underlying blockers haven't moved.

## Risks: things that could fail unexpectedly
Ranked most-severe first.

1. **New: three days of fixes sitting uncommitted, unprotected.** The class-capacity fix, the
   README correction, and the POPIA PDF are only in the git staging area — not committed, not
   pushed, not backed up anywhere else. A `git checkout -- .`, a bad `git reset`, a disk issue, or
   simply someone else cloning the repo right now would lose all of it silently (staged changes
   don't show up as "behind" to a collaborator — they just don't exist for anyone but this
   machine). This is pure process risk with a one-line fix: commit it.

2. **Class capacity race condition — fixed in code, but the fix isn't shipped.** Functionally
   resolved per the Nov 2 review (`for update` lock added, 159 assertions still pass), but since
   it's uncommitted it provides zero protection to anyone running migrations from the committed
   history, including whatever Phase 8 deploy eventually runs. Until this is committed, "the race
   is fixed" is only true on this machine's working tree.

3. **Real personal information still committed in plaintext.** `db/deploy/01_reset_remote.sql:14-17`
   still names two real people by full name and email in a comment that's part of git history.
   Confirmed intentional (own test accounts) per the 2026-11-02 interview — no action needed, but
   repeating unresolved for completeness since it's still visible on inspection.

4. **No safety gate before the irreversible remote schema reset — unchanged.**
   `db/deploy/01_reset_remote.sql` still runs `begin;...drop...;commit;` via the Supabase SQL
   Editor with no interactive confirmation step, unlike the Makefile's local `db-drop` target
   (`y/N` prompt). Relevant now specifically because Phase 8 — the next thing to actually run —
   is exactly the scenario this script is for.

5. **Silent error swallowing on read paths — unchanged.** `web/src/lib/admin.ts` and most of
   `queries.ts` still use `data ?? []` / `?? 0` without checking `.error`, so a failed query
   renders as empty state rather than a visible error. Write paths are fine.

6. **No pagination — unchanged**, not urgent at current scale.

## Security notes
No change from the 2026-11-02 pass. Lightweight review only; RLS and `requireRole` checks remain
solid. The committed PII (risk #3) and missing confirmation gate (risk #4) are the two
longest-standing open items.

## Open questions for you
1. **Why hasn't the staged work from Nov 2 been committed yet?** Was this deliberate (waiting
   for something), or did it just slip? If there's no reason to hold it, it should go in now —
   it's correct and tested.
2. **Phase 8 deploy** was the agreed next step three days ago and hasn't started. Is it still the
   priority, or has something else taken precedence? If it's still blocked on something (time,
   confidence, a missing credential), naming that blocker would help.
3. **POPIA sign-off** — same three `[TO CONFIRM]` fields, still no owner/timeline. Is this
   actively being chased with an attorney, or stalled?
