# Application Architecture & Authentication Boundaries

Separating `web/` into two standalone Next.js applications (`apps/client` and `apps/admin`) requires strict isolation of routing, role resolution (`homeFor`), login gates, and middleware (`proxy.ts`). If `homeFor()` or `requireRole()` continues to assume all four portals exist on the same host, cross-role redirects will 404.

---

## 1. Shared Auth Primitives (`@skolopals/shared/auth`)

In the current monolith, `web/src/lib/auth.ts` defines a single `HOME` map containing `["admin", "/admin"]` alongside `tutor`, `parent`, and `learner`. Once `/admin` is removed from `apps/client` and `/parent`/`/tutor`/`/learner` are removed from `apps/admin`, `packages/shared/src/auth.ts` must separate client role resolution from admin role enforcement:

```ts
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { api, ApiError } from "./api/client";
import { createClient } from "./supabase/server";
import type { AppRole, Row } from "./database.types";

export type Session = {
  profile: Row<"profiles">;
  roles: AppRole[];
};

type MyProfileResponse = {
  id: string;
  fullName: string;
  phone?: string;
  email: string;
  createdAt: string;
  roles: string[];
};

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  try {
    const me = await api.get<MyProfileResponse>("/people/me");
    return {
      profile: {
        id: me.id,
        full_name: me.fullName,
        phone: me.phone ?? null,
        created_at: me.createdAt,
      },
      roles: me.roles as AppRole[],
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

/** Client-app role priority: never returns "/admin" because /admin does not exist in apps/client. */
const CLIENT_HOME: Array<[AppRole, string]> = [
  ["tutor", "/tutor"],
  ["parent", "/parent"],
  ["learner", "/learner"],
];

export function clientHomeFor(roles: AppRole[]): string {
  return CLIENT_HOME.find(([role]) => roles.includes(role))?.[1] ?? "/";
}

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Client workspace gate (used by /parent, /learner, /tutor in apps/client). */
export async function requireClientRole(role: "parent" | "learner" | "tutor"): Promise<Session> {
  const session = await requireUser();
  if (!session.roles.includes(role)) redirect(clientHomeFor(session.roles));
  return session;
}

/** Admin workspace gate (used by /admin in apps/admin). */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!session.roles.includes("admin")) redirect("/login?error=forbidden");
  return session;
}
```

> **Backwards-compatible alias:** `requireRole` can remain exported from `@skolopals/shared/auth` as a wrapper that dispatches `role === "admin" ? requireAdmin() : requireClientRole(role)` so existing `requireRole("admin")` / `requireRole("tutor")` call sites across all `actions.ts` and `layout.tsx` files continue to work without changing their function signature.

---

## 2. `apps/client` (`@skolopals/client`) Architecture

### 2.1 Middleware (`apps/client/src/proxy.ts`)

1. Remove `"/admin"` from `PROTECTED`:
   ```ts
   const PROTECTED = ["/parent", "/learner", "/tutor"];
   ```
2. Any visit to `/admin` on `apps/client` falls through to Next.js's 404 (`not-found.tsx`).

### 2.2 Client Authentication (`apps/client/src/app/(auth)/actions.ts`)

1. `login()` authenticates with Supabase Auth and fetches `GET /people/me`.
2. If the user holds **only** the `"admin"` role (no `tutor`, `parent`, or `learner` role), `login()` signs out the session on `apps/client` and returns `{ error: "Administrator accounts must sign in via the Admin Portal.", email }` rather than redirecting to a dead `/admin` route or an unauthorized `/parent` portal.
3. Otherwise, `login()` redirects to `safeNext(formData.get("next")) ?? clientHomeFor(me.roles as AppRole[])`.
4. `signup()` and `signOut()` remain unchanged.

### 2.3 Next.js Configuration (`apps/client/next.config.ts`)

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  transpilePackages: ["@skolopals/ui", "@skolopals/shared"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

---

## 3. `apps/admin` (`@skolopals/admin`) Architecture

### 3.1 Root Redirect (`apps/admin/src/app/page.tsx`)

Per the agreed routing design, all admin screens keep their existing `/admin/*` URL paths (zero path refactoring across `revalidatePath("/admin/...")` or sidebar `NavItem` links), and visiting `/` redirects immediately to `/admin`:

```ts
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/admin");
}
```

### 3.2 Middleware (`apps/admin/src/proxy.ts`)

Every route on `apps/admin` except `/login` and `/auth/confirm` requires an active Supabase session:

```ts
const PUBLIC_PATHS = ["/login", "/auth/confirm"];

// Inside proxy(request):
const { pathname, search } = request.nextUrl;
const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

if (!isPublic && !signedIn) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") {
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
  }
  return NextResponse.redirect(url);
}
```

### 3.3 Admin-Only Authentication (`apps/admin/src/app/(auth)/actions.ts`)

1. **No `signup()` Server Action and no `/signup` route** exist in `apps/admin`. Administrator accounts are provisioned centrally by the centre, never self-registered.
2. **Fail-Fast Role Verification at Login**:
   ```ts
   export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
     const email = String(formData.get("email") ?? "").trim();
     const password = String(formData.get("password") ?? "");
     if (!email || !password) return { error: "Enter your email address and password.", email };

     const supabase = await createClient();
     const { data, error } = await supabase.auth.signInWithPassword({ email, password });
     if (error || !data.user) {
       return { error: "That email and password don’t match an account.", email };
     }

     const me = await api.get<{ roles: string[] }>("/people/me");
     if (!me.roles.includes("admin")) {
       await supabase.auth.signOut();
       return { error: "Access denied. This portal is restricted to administrators.", email };
     }

     redirect(safeNext(formData.get("next")) ?? "/admin");
   }

   export async function signOut() {
     const supabase = await createClient();
     await supabase.auth.signOut();
     redirect("/login");
   }
   ```
3. **Admin Login Form (`apps/admin/src/app/(auth)/login/login-form.tsx`)**:
   - Heading: `"Admin Sign In"` / `"Sign in to manage Skolopals Tutoring Centre."`
   - Removes the `"New to Skolopals? Sign Up"` footer link.
   - Displays an alert if redirected with `?error=forbidden`.

### 3.4 Admin Error & 404 Boundaries (`apps/admin/src/app/{error.tsx,not-found.tsx}`)

- `not-found.tsx` does **not** render `<PublicNav />` (which belongs exclusively to `apps/client`). It renders `<StatusState>` with `<ButtonLink href="/admin">Back to dashboard</ButtonLink>`.
- `error.tsx` replaces `<ButtonLink href="/contact">` with `<ButtonLink href="/admin" variant="secondary">Back to dashboard</ButtonLink>`.
- `layout.tsx` sets `robots: { index: false, follow: false }` in `metadata` so search engines never index the admin portal.

---

## 4. Import Alias Rewriting Summary

To keep page and action files inside `apps/client` and `apps/admin` clean and minimal during migration:

| Original Import in `web/src/**` | New Import in `apps/client` and `apps/admin` |
| :--- | :--- |
| `@/components/ui` | `@skolopals/ui/ui` |
| `@/components/logo` | `@skolopals/ui/logo` |
| `@/components/nav-link` | `@skolopals/ui/nav-link` |
| `@/components/coming-soon` | `@skolopals/ui/coming-soon` |
| `@/components/app-shell` | `@skolopals/ui/app-shell` |
| `@/lib/database.types` | `@skolopals/shared/database.types` |
| `@/lib/api/client` | `@skolopals/shared/api` |
| `@/lib/supabase/server` | `@skolopals/shared/supabase/server` |
| `@/lib/supabase/client` | `@skolopals/shared/supabase/client` |
| `@/lib/auth` | `@skolopals/shared/auth` |
| `@/lib/format` | `@skolopals/shared/format` |
| `@/lib/queries` *(in `apps/admin`)* | `@skolopals/shared/reference` |
| `@/lib/queries` *(in `apps/client`)* | `@/lib/queries` *(re-exports `@skolopals/shared/reference`)* |
| `@/lib/{admin,parent,tutor,assessment,messages,centre,consent}` | `@/lib/{...}` *(unchanged app-local alias)* |
