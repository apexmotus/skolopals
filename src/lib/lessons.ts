import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/database.types";

export type LessonRow = Booking & {
  tutors: { full_name: string; slug: string; profile_id: string | null } | null;
  profiles: { full_name: string; grade_level: string | null } | null;
};

const SELECT = "*, tutors(full_name, slug, profile_id), profiles!bookings_student_id_fkey(full_name, grade_level)";

/** Bookings visible to the current user (RLS scopes to student/tutor/admin). */
export async function listLessons(opts: { when?: "upcoming" | "past"; tutorId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  let q = supabase.from("bookings").select(SELECT);
  if (opts.tutorId) q = q.eq("tutor_id", opts.tutorId);
  if (opts.when === "upcoming") q = q.gte("starts_at", now).in("status", ["pending", "confirmed"]).order("starts_at");
  else if (opts.when === "past") q = q.or(`starts_at.lt.${now},status.in.(completed,cancelled)`).order("starts_at", { ascending: false });
  else q = q.order("starts_at", { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as LessonRow[];
}

export async function getLesson(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select(SELECT).eq("id", id).maybeSingle();
  return data as unknown as LessonRow | null;
}

/** Past confirmed lessons count as completed even before a tutor marks them. */
export function effectiveStatus(b: Booking) {
  if (b.status === "confirmed" && new Date(b.starts_at).getTime() + b.duration_minutes * 60_000 < Date.now()) return "completed";
  return b.status;
}
