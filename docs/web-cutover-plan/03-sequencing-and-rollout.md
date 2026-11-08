# Sequencing, Local Dev, and Rollout

## Local-dev port collision (resolve before writing any code)

`api/`'s `PORT` defaults to `3000` (`env.schema.ts`) — the same port Next.js's dev server uses.
Running both locally at once (required to actually test the cutover, not just typecheck it)
needs one of them moved: simplest is `api/.env`'s `PORT=4000` (or similar), with `web/.env.local`'s
`API_URL=http://localhost:4000/api/v1` pointing at it. Note this in both READMEs once decided —
not a design problem, just a thing that'll silently 404 everything if missed.

## Order of migration

Module-by-module, each as its own reviewable PR — not a big-bang rewrite. Rationale: 62 read
call sites and 15 write call sites is a lot to review and live-verify in one pass, and this
mirrors the exact discipline that caught 5 real RLS gaps and 2 cross-cutting bugs while the API
itself was built module-by-module (see [[skolopals-nestjs-api-plan]]) — a mocked test doesn't
catch a wrong assumption about what a real endpoint returns; only running the real page against
the real API does, and that's much easier to do carefully for one module at a time than for all
of them at once.

1. **The API client + auth/session slice** (`02-api-client-and-auth.md`) — blocking, do first.
2. **`reference` + `packages` + public `timetable`** — read-only, public or near-public data,
   lowest risk, and exercises the client against the widest variety of simple `GET`s
   (`src/lib/queries.ts`, the privacy/enrol pages' consent-types reads) before anything
   write-heavy or role-gated.
3. **`people` + `tutors`** — `lib/auth.ts`'s remaining reads (`getMyTutor`/`getMyLearners`),
   the admin tutors workspace, the public tutor directory/profile.
4. **`enquiries` + `enrolment` + `packages` writes** — the public enrolment funnel
   (`(public)/enrol/actions.ts`'s `submit_enrolment`) and admin activation flow.
5. **`timetable` + `attendance` + `programmes`** — the admin scheduling workspace and the
   tutor/parent session views.
6. **`assessment` + `progress-reports`** — the tutor assessment/reporting workspace.
7. **`billing` + `finance`** — the highest-stakes module in the API itself per its own framing;
   migrate last among the "business" modules, once the client pattern is well-proven elsewhere.
8. **`consent` + `communication` + `resources` + `reviews`** — whatever's left; none of these
   gate anything else.
9. **Cleanup**: once no `.from()`/`.rpc()` call remains outside the auth flows
   (`(auth)/actions.ts`, `auth/confirm/route.ts`, `proxy.ts`), decide whether to trim
   `database.types.ts` down to just what those files still need (`profiles`, `user_roles`) or
   leave it generated-in-full for convenience — a real decision, not pre-made here.

## Per-module verification (same shape every time)

1. Swap the lib/action file's internals to call `api.*` instead of `supabase.*`.
2. Update that file's direct callers to the API's camelCase DTO shape. **Don't build a
   translation shim back to the old snake_case row shape** — each module is migrated as one
   vertical slice (lib file + its actual callers) in a single PR anyway, so adopting the DTO
   shape at the call site directly is less code than maintaining a permanent mapping layer whose
   only job is to pretend the API never happened.
3. Run `pnpm typecheck`/`pnpm lint` in `web/`.
4. **Run `web/` locally against a real locally-running `api/`** (not just against mocks) and
   click through every page/action this slice touches, as each of the roles that can reach it.
   This is the step that actually catches a wrong endpoint-shape assumption — restated from
   `02-api-client-and-auth.md` because it's worth restating per module, not just once.
5. Only then merge.

## Rollback posture

No feature-flag system exists in this stack (nothing in `package.json` resembling
GrowthBook/`flags-sdk`/similar), and nothing here needs one: each PR is a small, self-contained
vertical slice behind normal code review, so "rollback" is "revert that one PR" — the blast
radius of a bad slice is one module's pages, not the whole app, precisely because of the
module-by-module ordering above. Don't introduce a flag system for this; it would be new
infrastructure solving a problem the sequencing already solves.

## What ships where

Once a first full pass through the list above is done, `api/` and `web/` each get their own
Vercel project (per the earlier Vercel-deployment-architecture discussion — see
[[skolopals-nestjs-api-plan]]'s 2026-11-08 update) and their own env vars set in each project's
dashboard. `API_URL` in `web/`'s Vercel project points at the deployed `api/` project's URL.
Nothing about this phase's migration work is Vercel-specific — it would look identical if `api/`
were hosted anywhere else; the Vercel project setup is a separate, mechanical step once the
migration itself is done (or far enough along to deploy incrementally, if that's preferred over
one cutover release — an open question for whoever is ready to deploy, not decided here).
