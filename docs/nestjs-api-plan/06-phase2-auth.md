# Phase 2 — Auth

**Rewritten 2026-11-05 — drastically smaller than the SQL Server version of this file.**
Supabase Auth is kept (`04-phase0-schema-port-and-cutover-strategy.md` §2), so this phase does
not build registration, login, refresh, logout, email confirmation, or password hashing — all
of that already exists and keeps running exactly as it does today, in Supabase, called directly
by `web/` via `@supabase/supabase-js`. This phase builds exactly one thing: **a guard that
verifies a Supabase-issued JWT** so the rest of the API can trust `req.user`.

## What this phase builds

1. `JwtAuthGuard` (global, `APP_GUARD`) — verifies the incoming `Authorization: Bearer <token>`
   against `SUPABASE_JWT_SECRET` (HS256; confirm this project's Supabase instance hasn't been
   switched to asymmetric JWT signing/JWKS, in which case swap to that verification method
   instead — check the Supabase dashboard's JWT settings for this project before assuming HS256).
   On success, attaches the decoded claims to `req.user`: at minimum `sub` (the Supabase
   `auth.users.id`, a `uuid` — this is the actor's identity everywhere downstream) and whatever
   role/claim shape the token actually carries (confirm during this phase whether a Postgres
   auth hook already injects `roles` into the token, or whether the guard/Manager must look them
   up from `public.user_roles` separately — do this once, here, rather than re-deciding it per
   module).
2. `RolesGuard` (global, after `JwtAuthGuard`), `@Public()`, `@Roles()`, `@CurrentUser()` —
   generic spec §8.3 shapes kept; contents are "check claims already on `req.user`", not
   "decode and validate a self-issued token," since there's nothing self-issued here.
3. The `req.user.sub` value (plus the full decoded claims, JSON-encoded) is exactly what
   `StoredProcRunner` forwards into `set_config('request.jwt.claims', ...)` per
   `04-phase0...md` §1 — this is the one place `JwtAuthGuard`'s output and the database layer's
   RLS mechanism connect. Confirm the claims shape the guard produces is the same shape Postgres
   RLS policies expect from `auth.jwt()` today (it should be, since it's literally the same
   token Supabase issued) — don't let the API re-shape or rename claims on the way through.
4. `GET /auth/me` (optional convenience endpoint) — `any` role, returns the actor's own profile
   via the equivalent of `usp_User_GetById`/whatever `people` module read already covers this.
   Not required; `web/` already has the decoded JWT client-side from Supabase and may not need
   this at all. Build it only if `web/`'s actual pages ask for it once this phase is reached.

## What this phase explicitly does not build

- No `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/confirm-email`,
  `/auth/resend-confirmation`. `web/` keeps calling Supabase Auth directly for every one of
  these, unchanged from today.
- No `Users`/`RefreshTokens` tables or repositories, no argon2id, no `EmailService`/SendGrid
  integration. None of it is needed; Supabase Auth already does all of it.
- No token rotation/reuse-detection logic — that's Supabase SDK/Auth's responsibility on the
  `web/` side, not this API's.

## First admin account

Unchanged conclusion from the earlier plan, simpler mechanism: insert the `admin` row into
`public.user_roles` directly (Supabase dashboard SQL console, or a one-off script using the
service-role key) for the first real admin user, exactly how this is already done today per
project memory. No seed script or bootstrap endpoint needs designing in this phase — this was
never actually blocked on the SQL Server port.

## Password reset

Out of scope for this plan either way — `web/src/app/(auth)/` has no "forgot password" flow
today even though Supabase Auth supports one. Independent of the SQL-Server reversal; flag to
the owner as a pre-existing gap worth closing eventually.

## Business rules (generic spec §1.7 for this module)

- A tutor or admin account is never created through anything resembling self-registration —
  tutor accounts are created exclusively via the `tutors` module's create path (Phase 3a) acting
  on an *existing* Supabase Auth user; admin is granted directly as above. This is unchanged
  from the original plan's intent, just no longer this API's code to enforce at signup, since
  there is no signup endpoint in this API.
- Cacheable: none (auth must always be consistent and live).

## Verify

- E2E: protected route without a token (401), protected route with a token but the wrong role
  (403), protected route with a valid Supabase-issued token for each role (200, correct data
  scoped to that actor via RLS — this is actually the first real end-to-end proof that
  `04-phase0...md` §1's `set_config`/`SET LOCAL ROLE` pattern works, since every protected route
  exercises it).
- Unit: `JwtAuthGuard` with a valid token, an expired token, a token signed with the wrong
  secret, and a malformed `Authorization` header — all four cases, not just the happy path.
- No test in this module should ever construct its own JWT by hand with a fabricated secret and
  call it realistic — use a real Supabase test user's token (from a dev/test Supabase project or
  branch) for at least the E2E pass, since the whole point of this phase is trusting Supabase's
  actual signing, not a stand-in.
