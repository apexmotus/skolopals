import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Signed-in tutor's profile and marketplace listing (null until approved). */
export async function getTutorContext() {
  const profile = await requireRole("tutor");
  const supabase = await createClient();
  const { data: tutor } = await supabase.from("tutors").select("*").eq("profile_id", profile.id).maybeSingle();
  return { profile, tutor };
}

/** For pages that only make sense once the tutor listing exists. */
export async function requireTutorListing() {
  const ctx = await getTutorContext();
  if (!ctx.tutor) redirect("/tutor/application");
  return { profile: ctx.profile, tutor: ctx.tutor };
}

export const PAYOUT_SHARE = 0.6;
