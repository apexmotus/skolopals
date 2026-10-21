import "server-only";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** The signed-in tutor's staff record. Admin-created, so it always exists. */
export async function getTutorContext() {
  const session = await requireRole("tutor");
  const supabase = await createClient();
  const { data: tutor } = await supabase
    .from("tutors")
    .select("*")
    .eq("profile_id", session.profile.id)
    .maybeSingle();
  // A tutor role without a tutor record means an incomplete admin setup.
  if (!tutor) redirect("/");
  return { profile: session.profile, tutor };
}

/** Classes this tutor teaches in the current term. */
export async function getMyClasses(tutorId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_groups")
    .select("*, subjects(name), languages(name), rooms(name), class_group_grades(grade_code)")
    .eq("tutor_id", tutorId)
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

/** Sessions in a date window, for the schedule and the register. */
export async function getMySessions(tutorId: string, fromISO: string, toISO: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_sessions")
    .select("*, class_groups!inner(id, name, tutor_id, subjects(name), rooms(name))")
    .eq("class_groups.tutor_id", tutorId)
    .gte("session_date", fromISO)
    .lte("session_date", toISO)
    .order("starts_at");
  return data ?? [];
}

/** Learners currently placed in any of this tutor's classes. */
export async function getMyLearners(tutorId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_enrolments")
    .select("learner_id, class_groups!inner(id, name, tutor_id), learners(id, full_name, grade_code)")
    .eq("class_groups.tutor_id", tutorId)
    .is("left_on", null);
  const seen = new Map<string, { id: string; full_name: string; grade_code: string; classes: string[] }>();
  for (const row of data ?? []) {
    if (!row.learners) continue;
    const existing = seen.get(row.learners.id);
    const className = row.class_groups?.name ?? "";
    if (existing) existing.classes.push(className);
    else seen.set(row.learners.id, { ...row.learners, classes: [className] });
  }
  return [...seen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** Sessions taught and hours, by month. Tutors are paid as staff, not a share. */
export async function getSessionLoad(tutorId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_tutor_session_load")
    .select("*")
    .eq("tutor_id", tutorId)
    .order("month", { ascending: false });
  return data ?? [];
}

export async function getMyPayRate(tutorId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("tutor_pay_rates")
    .select("*")
    .eq("tutor_id", tutorId)
    .lte("effective_from", today)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.effective_to && data.effective_to <= today) return null;
  return data;
}
