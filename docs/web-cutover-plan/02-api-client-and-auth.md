# The API Client + the Auth/Session Slice

The only genuinely new code this phase needs — everything else is swapping an existing call's
internals for a call to it. Build this once, verify it against a real running `api/` instance,
then it's done.

## Why this is simpler than a typical "frontend calls backend" integration

Confirmed in `00-overview.md`: every single Supabase call in `web/` already runs server-side
(Server Components or `"use server"` Server Actions via `lib/supabase/server.ts`'s cookie-based
client). There is no client-side fetch to design, no token to ever expose to the browser, and no
CORS concern for this traffic — it's Next.js's own server process calling the API's server
process, not a browser calling it. `CORS_ORIGINS` on the API side (already configured for
`web/`'s domain) stays as defensive configuration, not something this traffic actually depends
on.

## `web/src/lib/api/client.ts` (new)

A thin, server-only fetch wrapper, following the same `import "server-only"` pattern
`lib/auth.ts` already uses so it can never accidentally end up in a client bundle.

Responsibilities:
1. **Base URL**: a server-only env var (`API_URL`, not `NEXT_PUBLIC_*` — it's never read by the
   browser) pointing at the deployed `api/` Vercel project, e.g.
   `https://skolopals-api.vercel.app/api/v1`. Locally, point at wherever `api/` is actually
   running — see the port-collision note in `03-sequencing-and-rollout.md`.
2. **Auth**: get the current request's Supabase session via `lib/supabase/server.ts`'s
   `createClient()` → `supabase.auth.getSession()` → `session.access_token`, and send it as
   `Authorization: Bearer <token>`. This is the same JWT Supabase Auth already issued and that
   `proxy.ts`/`getSession()` already decode locally — nothing new is minted, it's just forwarded.
3. **Error-shape mapping**: the API's errors are always
   `{ status, code, title, detail, traceId, path, timestamp, errors? }` (per the API's own
   `docs/sp-contract.md` and `AllExceptionsFilter`). Map this to whatever each call site already
   expects:
   - Server Actions: most already return `{ error?: string }` state (e.g. `TutorState`,
     `AuthState`) via `useActionState` — have the client throw a typed `ApiError` and let each
     action's existing `catch`/`clean(error.message)`-style handling extract `.detail`, so the
     user-facing message stays exactly as good as today's Postgres-message-derived one.
   - Server Components (plain reads): let `ApiError` propagate to Next.js's nearest `error.tsx`
     boundary for anything unexpected; **401 is a special case** (see below).
4. **401 handling**: a 401 from the API means the forwarded session is no longer valid —
   `proxy.ts` should normally have already caught this and redirected to `/login` first, but a
   client call is a legitimate fallback to catch a session that expired mid-request. Redirect to
   `/login?next=<current path>`, matching `proxy.ts`'s own redirect shape, rather than surfacing
   it as a generic error.
5. **403 is NOT the same as 401**: a role-permitted-but-RLS/role-denied response is a real,
   expected outcome for some actors (the API's billing/consent/people modules deliberately return
   403 for a wrong-role actor per [[skolopals-nestjs-api-plan]]'s "403 not 404" convention) — this
   should surface as an in-page message or a redirect to the actor's own home
   (`homeFor(roles)`, already in `lib/auth.ts`), never treated as a session problem.
6. **No retry/backoff logic** — this isn't a flaky external API, it's a sibling Vercel project on
   the same deploy; a failure is either a real 4xx (handled above) or a 5xx that should surface
   like any other failed Server Action/Component today.

Shape (illustrative, not final — write this during implementation, not here):

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export class ApiError extends Error {
  constructor(public status: number, public code: string, detail: string) {
    super(detail);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${process.env.API_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.code ?? "UNKNOWN", body?.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
```

**Verify this against a real running `api/` instance before migrating anything else** — the same
"boot it and curl it" discipline the API itself used throughout its own build (see
[[skolopals-nestjs-api-plan]]'s repeated live-verification notes). A unit test with a mocked
`fetch` cannot catch a wrong base-URL join, a missed `Bearer` prefix, or a mismatched error-body
shape; only an actual request against the actual API does.

## The auth/session slice (do this right after the client exists)

`lib/auth.ts`'s `getSession()` and `(auth)/actions.ts`'s `login()` both read `user_roles`
directly today. Replace both with a call to `GET /people/me` through the new client.

**First thing to confirm, not assume**: does `GET /people/me` (`people.controller.ts` →
`people.manager.ts`) already return roles in its response, or only the profile? If it's
profile-only, `JwtAuthGuard`'s own role lookup (`UserRolesRepository`, confirmed in
[[skolopals-nestjs-api-plan]] as "the one piece of the `auth` module this API actually builds")
happens API-side but isn't necessarily echoed back to the caller — check before assuming one call
suffices. If a second call or a response-shape change is needed, that's a small, additive change
to the already-built `people` module, not a redesign.

This slice is the dependency every other page sits on (`requireUser`/`requireRole` gate nearly
every protected route) — get it live-verified (log in as each of the four roles against a real
locally-running `api/`, confirm `homeFor`/role-gating still redirects correctly) before starting
any other module's migration.
