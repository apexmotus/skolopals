import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Row } from "@/lib/database.types";

export type Session = {
  profile: Row<"profiles">;
  /** A person may hold several roles - a parent who also tutors, say. */
  roles: AppRole[];
};

/** The `GET /people/me` response shape (`MyProfileDto`, `api/src/modules/people/dto/profile.dto.ts`). */
type MyProfileResponse = {
  id: string;
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
      profile: { id: me.id, full_name: me.fullName, phone: me.phone ?? null, created_at: me.createdAt },
      roles: me.roles as AppRole[],
    };
  } catch (error) {
    // The JWT's `sub` claim decoded locally above, but the profile row is gone (deleted account).
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

/** Order matters: the most capable role wins when someone holds several. */
const HOME: Array<[AppRole, string]> = [
  ["admin", "/admin"],
  ["tutor", "/tutor"],
  ["parent", "/parent"],
  ["learner", "/learner"],
];

export function homeFor(roles: AppRole[]) {
  return HOME.find(([role]) => roles.includes(role))?.[1] ?? "/parent";
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Gate a workspace. Someone holding the role gets in, whatever else they are. */
export async function requireRole(role: AppRole) {
  const session = await requireUser();
  if (!session.roles.includes(role)) redirect(homeFor(session.roles));
  return session;
}
