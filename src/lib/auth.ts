import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/database.types";

/** The signed-in user's profile, or null. Cached per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return profile ?? null;
});

export function homeFor(role: UserRole) {
  return role === "admin" ? "/admin" : role === "tutor" ? "/tutor" : "/student";
}

/** Gate a workspace to one role; other signed-in users go to their own home. */
export async function requireRole(role: UserRole) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== role) redirect(homeFor(profile.role));
  return profile;
}

export async function requireUser() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}
