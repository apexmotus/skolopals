import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Row } from "@/lib/database.types";

export type Session = {
  profile: Row<"profiles">;
  /** A person may hold several roles - a parent who also tutors, say. */
  roles: AppRole[];
};

/** The signed-in user's profile and roles, or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!profile) return null;

  return { profile, roles: (roleRows ?? []).map((r) => r.role) };
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

/** The tutor record for the signed-in user, or null. */
export const getMyTutor = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("tutors").select("*").eq("profile_id", session.profile.id).maybeSingle();
  return data;
});

/** Learners the signed-in guardian is responsible for. */
export const getMyLearners = cache(async () => {
  const session = await getSession();
  if (!session) return [];
  const supabase = await createClient();
  // RLS limits this to the caller's own learners; no extra filter is needed,
  // but the join keeps the query honest about why they are visible.
  const { data } = await supabase
    .from("learner_guardians")
    .select("relationship, is_billing_contact, learners(*)")
    .eq("guardian_id", session.profile.id);
  return (data ?? []).flatMap((row) => (row.learners ? [{ ...row.learners, relationship: row.relationship }] : []));
});
