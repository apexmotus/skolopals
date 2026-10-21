"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type BuilderState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createTerm(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  await requireRole("admin");
  const year = Number(text(formData, "year"));
  const termNumber = Number(text(formData, "term_number"));
  const startsOn = text(formData, "starts_on");
  const endsOn = text(formData, "ends_on");
  if (!year || !termNumber || !startsOn || !endsOn) return { error: "Fill in every field." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("terms")
    .insert({ year, term_number: termNumber, starts_on: startsOn, ends_on: endsOn });
  // The exclusion constraint stops overlapping terms; surface it plainly.
  if (error) {
    return {
      error: /exclusion|overlap/i.test(error.message)
        ? "Those dates overlap a term that already exists."
        : error.message,
    };
  }
  revalidatePath("/admin/timetable");
  return { ok: `Term ${termNumber} of ${year} added.` };
}

export async function createRoom(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  await requireRole("admin");
  const name = text(formData, "name");
  const capacity = Number(text(formData, "capacity"));
  if (!name || !capacity) return { error: "A room needs a name and a capacity." };

  const supabase = await createClient();
  const { error } = await supabase.from("rooms").insert({ name, capacity });
  if (error) return { error: error.message };
  revalidatePath("/admin/timetable");
  return { ok: `${name} added.` };
}

/** Create a class and its weekly slots together, then generate the term's sessions. */
export async function createClassGroup(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  await requireRole("admin");

  const payload = {
    name: text(formData, "name"),
    subject_code: text(formData, "subject_code"),
    language_code: text(formData, "language_code"),
    tutor_id: text(formData, "tutor_id"),
    term_id: text(formData, "term_id"),
    delivery_mode: text(formData, "delivery_mode"),
    room_id: text(formData, "room_id") || null,
    capacity: Number(text(formData, "capacity")),
  };
  const grades = formData.getAll("grade_code").map(String).filter(Boolean);
  const days = formData.getAll("day_of_week").map(String).filter(Boolean);
  const startsAt = text(formData, "starts_at_time");
  const endsAt = text(formData, "ends_at_time");

  if (!payload.name || !payload.subject_code || !payload.tutor_id || !payload.term_id) {
    return { error: "Name, subject, tutor and term are all required." };
  }
  if (grades.length === 0) return { error: "Choose at least one grade." };
  if (days.length === 0 || !startsAt || !endsAt) return { error: "Choose at least one day and a time." };
  if (payload.delivery_mode !== "online" && !payload.room_id) {
    return { error: "An in-centre class needs a room." };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase.from("class_groups").insert(payload).select("id").single();
  if (error) return { error: error.message };
  const classId = created.id;

  const { error: gradeError } = await supabase
    .from("class_group_grades")
    .insert(grades.map((grade_code) => ({ class_group_id: classId, grade_code })));
  if (gradeError) {
    // The competency trigger fires here: the tutor must teach this subject,
    // in this language, at every grade the class covers.
    await supabase.from("class_groups").delete().eq("id", classId);
    return {
      error: /not recorded as teaching/i.test(gradeError.message)
        ? gradeError.message.replace(/^.*?:\s*/, "")
        : gradeError.message,
    };
  }

  const { error: scheduleError } = await supabase.from("class_schedules").insert(
    days.map((d) => ({
      class_group_id: classId,
      day_of_week: Number(d),
      starts_at_time: startsAt,
      ends_at_time: endsAt,
    })),
  );
  if (scheduleError) {
    await supabase.from("class_groups").delete().eq("id", classId);
    return {
      error: /not open for tutoring/i.test(scheduleError.message)
        ? scheduleError.message.replace(/^.*?:\s*/, "")
        : scheduleError.message,
    };
  }

  const { data: generated, error: genError } = await supabase.rpc("generate_class_sessions", {
    p_class_group_id: classId,
  });
  if (genError) return { error: genError.message };

  revalidatePath("/admin/timetable");
  return { ok: `${payload.name} created with ${generated} sessions for the term.` };
}

export async function regenerateSessions(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  await requireRole("admin");
  const classId = text(formData, "class_group_id");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_class_sessions", { p_class_group_id: classId });
  if (error) return { error: error.message };
  revalidatePath("/admin/timetable");
  return { ok: data === 0 ? "Already up to date." : `Added ${data} sessions.` };
}
