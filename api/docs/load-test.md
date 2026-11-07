# Load test

`test/load/smoke.js` is a [k6](https://k6.io) script — a standalone Go binary, not an npm
package, so install it separately (`brew install k6`, or see k6's own install docs for other
platforms). It is **not** run by `pnpm test`/`pnpm test:e2e`; run it by hand, against a real
environment, when you actually want to observe load behaviour.

## What it exercises

Two scenarios, chosen because they're this app's actual traffic shape, not an arbitrary
"something cacheable, something writable" pair:

- **`GET /class-groups`** (constant 20 VUs by default) — a representative cacheable public read.
  Every portal page loads something like this on first paint; it's Redis-cached, so a healthy
  deployment's p95 should stay low even under sustained concurrent load.
- **`POST /class-sessions/:id/attendance`** (constant arrival rate, 10/minute by default) — the
  actual highest-frequency *write* during a real school day. Billing writes (recording a
  payment, running the monthly invoice job) are admin-rare — a handful of calls a month, not a
  load concern. A tutor marking attendance for every learner in every session, every afternoon,
  is the write path that actually needs headroom.

Default thresholds: `p(95) < 300ms`, error rate `< 1%` — both tunable in `test/load/smoke.js`'s
`options.thresholds` once you've observed real load and have an actual target to tune against;
these are starting points, not a number anyone has validated against production traffic yet.

## Running it

The script logs in as a seeded parent (for the read) and a seeded tutor (for the write) directly
against Supabase Auth, the same way `web/` does today — this API has no login endpoint of its
own (Supabase Auth stays external, per `../../docs/nestjs-api-plan/06-phase2-auth.md`). You need:

| Variable | What it is |
|---|---|
| `BASE_URL` | This API's base URL, e.g. `http://localhost:3000` (default) or a deployed URL. No trailing slash. |
| `SUPABASE_URL` | The Supabase project URL (same one `DATABASE_URL`/`SUPABASE_JWT_SECRET` belong to). |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → `anon`/`public` key. Only used to call Supabase Auth's own token endpoint, never sent to this API. |
| `PARENT_EMAIL` / `PARENT_PASSWORD` | Credentials for a seeded guardian account with at least one active class placement. |
| `TUTOR_EMAIL` / `TUTOR_PASSWORD` | Credentials for a seeded tutor account teaching `CLASS_SESSION_ID` below. |
| `CLASS_SESSION_ID` | A real `class_sessions.id` the tutor above teaches, with status `scheduled`/`held` (not `cancelled`). |
| `LEARNER_ID` | A learner placed in that session's class group. |
| `READ_VUS` | Optional, default `20`. |
| `WRITE_RATE_PER_MINUTE` | Optional, default `10`. |
| `DURATION` | Optional, default `2m`. |

```bash
BASE_URL=http://localhost:3000 \
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_ANON_KEY=... \
PARENT_EMAIL=parent@example.test PARENT_PASSWORD=... \
TUTOR_EMAIL=tutor@example.test TUTOR_PASSWORD=... \
CLASS_SESSION_ID=00000000-0000-0000-0000-000000000000 \
LEARNER_ID=00000000-0000-0000-0000-000000000000 \
k6 run test/load/smoke.js
```

## Reading the result

The write scenario marking the same learner's attendance twice (e.g. a second run against the
same fixture) correctly `409`s — `attendance_records` has a unique `(class_session_id,
learner_id)` constraint — so the script's own check only asserts "not a 5xx", not a bare 201.
Re-seed `CLASS_SESSION_ID`/`LEARNER_ID` (or mark the existing record absent first) between runs
if you want to observe the insert path specifically rather than the conflict path.

Never point this at a production Supabase project without the owner's explicit sign-off — it
writes real `attendance_records` rows (and consumes Supabase Auth login rate limits) against
whatever `SUPABASE_URL` you give it.
