import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { api, ApiError } from "./api/client";
import { createClient } from "./supabase/server";
import type { AppRole, Row } from "./database.types";

export type Session = {
  profile: Row<"profiles">;
  /** A person may hold several roles - a parent who also tutors, say. */
  roles: AppRole[];
};

/** The `GET /people/me` response shape (`MyProfileDto`, `api/src/modules/people/dto/profile.dto.ts`). */
type MyProfileResponse = {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  phone?: string;
  email: string;
  createdAt: string;
  roles: string[];
};

/** The signed-in user's profile and roles, or null. Cached per request. */
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
        first_name: me.firstName ?? "",
        last_name: me.lastName ?? "",
        full_name: me.fullName,
        phone: me.phone ?? null,
        created_at: me.createdAt,
      },
      roles: me.roles as AppRole[],
    };
  } catch (error) {
    // The JWT's `sub` claim decoded locally above, but the profile row is gone (deleted account).
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

import {
  assignableRolesFor,
  clientHomeFor,
  isAdminRole,
  isSuperAdminRole,
  type InvitableUserRole,
} from "./roles";

export {
  assignableRolesFor,
  clientHomeFor,
  isAdminRole,
  isSuperAdminRole,
  type InvitableUserRole,
};

/** Backwards-compatible alias for clientHomeFor. */
export const homeFor = clientHomeFor;

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

/** Admin workspace gate (used by /admin in apps/admin). Admits both admin and superadmin. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!isAdminRole(session.roles)) redirect("/login?error=forbidden");
  return session;
}

/** Gate a workspace. Dispatches admin vs client roles so existing call sites continue to work. */
export async function requireRole(role: AppRole): Promise<Session> {
  if (role === "admin" || role === "superadmin") return requireAdmin();
  return requireClientRole(role);
}
