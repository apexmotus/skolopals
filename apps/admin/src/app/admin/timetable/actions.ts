"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@skolopals/shared/supabase/server";
import { requireRole } from "@skolopals/shared/auth";
import { dayName, normaliseMeetingUrl } from "@skolopals/shared/format";
import { getGrades, getLanguages, getSubjects } from "@skolopals/shared/reference";

export type BuilderState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

type Supabase = Awaited<ReturnType<typeof createClient>>;

const BAD_MEETING_LINK = "That meeting link is not a valid https:// address.";

/**
 * The meeting link lives on each session, not the class: class_groups is
 * publicly readable, class_sessions is not. Only today's and later sessions
 * are touched, so past sessions keep the link they actually ran on.
 */
/**
 * The competency trigger says "Tutor is not recorded as teaching <subject> in
 * <language> at: <grades>" in codes. Spell it out with names, and say where to fix it.
 */
async function competencyMessage(
  supabase: Supabase,
  tutorId: string,
  subjectCode: string,
  languageCode: string,
  dbMessage: string,
) {
  const missing = (dbMessage.split(/at:\s*/)[1] ?? "").split(/,\s*/).filter(Boolean);
  const [subjects, languages, grades, { data: tutor }] = await Promise.all([
    getSubjects(),
    getLanguages(),
    getGrades(),
    supabase.from("tutors").select("profiles(full_name)").eq("id", tutorId).maybeSingle(),
  ]);
  const name = <T extends { code: string; name: string }>(list: T[], code: string) =>
    list.find((x) => x.code === code)?.name ?? code;
  const who = tutor?.profiles?.full_name ?? "This tutor";
  const gradeNames = missing.map((g) => name(grades, g)).join(", ");
  return (
    `${who} is not recorded as teaching ${name(subjects, subjectCode)} in ` +
    `${name(languages, languageCode)} at ${gradeNames || "every grade chosen"}. ` +
    "Add it to their subjects on the Tutors page, or choose another tutor."
  );
}

async function applyMeetingLink(supabase: Supabase, classId: string, url: string | null) {
  return supabase
    .from("class_sessions")
    .update({ meeting_url: url })
    .eq("class_group_id", classId)
    .gte("session_date", new Date().toISOString().slice(0, 10));
}

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
  const rawMeetingUrl = payload.delivery_mode === "in_centre" ? "" : text(formData, "meeting_url");
  const meetingUrl = normaliseMeetingUrl(rawMeetingUrl);

  if (!payload.name || !payload.subject_code || !payload.tutor_id || !payload.term_id) {
    return { error: "Name, subject, tutor and term are all required." };
  }
  if (grades.length === 0) return { error: "Choose at least one grade." };
  if (days.length === 0 || !startsAt || !endsAt) return { error: "Choose at least one day and a time." };
  if (payload.delivery_mode !== "online" && !payload.room_id) {
    return { error: "An in-centre class needs a room." };
  }
  if (rawMeetingUrl && !meetingUrl) return { error: BAD_MEETING_LINK };

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
        ? await competencyMessage(
            supabase,
            payload.tutor_id,
            payload.subject_code,
            payload.language_code,
            gradeError.message,
          )
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
      // "...on ISO day 6 between 15:00:00 and 16:00:00" -> "...on Saturday between 15:00 and 16:00"
      error: /not open for tutoring/i.test(scheduleError.message)
        ? scheduleError.message
            .replace(/^.*?(The centre)/, "$1")
            .replace(/ISO day (\d)/, (_, d: string) => dayName(Number(d)))
            .replace(/(\d{2}:\d{2}):\d{2}/g, "$1")
        : scheduleError.message,
    };
  }

  const { data: generated, error: genError } = await supabase.rpc("generate_class_sessions", {
    p_class_group_id: classId,
  });
  if (genError) return { error: genError.message };

  if (meetingUrl) {
    const { error: linkError } = await applyMeetingLink(supabase, classId, meetingUrl);
    if (linkError) return { error: `Class created, but the meeting link was not saved: ${linkError.message}` };
  }

  revalidatePath("/admin/timetable");
  return { ok: `${payload.name} created with ${generated} sessions for the term.` };
}

export async function regenerateSessions(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  await requireRole("admin");
  const classId = text(formData, "class_group_id");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_class_sessions", { p_class_group_id: classId });
  if (error) return { error: error.message };

  // Newly generated sessions start without a link; carry the current one over.
  if (data) {
    const { data: linked } = await supabase
      .from("class_sessions")
      .select("meeting_url")
      .eq("class_group_id", classId)
      .not("meeting_url", "is", null)
      .order("session_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (linked?.meeting_url) {
      await supabase
        .from("class_sessions")
        .update({ meeting_url: linked.meeting_url })
        .eq("class_group_id", classId)
        .is("meeting_url", null)
        .gte("session_date", new Date().toISOString().slice(0, 10));
    }
  }

  revalidatePath("/admin/timetable");
  return { ok: data === 0 ? "Already up to date." : `Added ${data} sessions.` };
}

/** Set (or clear) the Zoom/Teams/Meet link on a class's upcoming sessions. */
export async function setMeetingLink(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  await requireRole("admin");
  const classId = text(formData, "class_group_id");
  const raw = text(formData, "meeting_url");
  const url = normaliseMeetingUrl(raw);
  if (raw && !url) return { error: BAD_MEETING_LINK };

  const supabase = await createClient();
  const { error } = await applyMeetingLink(supabase, classId, url);
  if (error) return { error: error.message };
  revalidatePath("/admin/timetable");
  return { ok: url ? "Meeting link saved on upcoming sessions." : "Meeting link removed." };
}

/** Place a learner into a class, against their active enrolment. */
export async function placeLearner(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  await requireRole("admin");
  const classId = text(formData, "class_group_id");
  const learnerId = text(formData, "learner_id");
  if (!learnerId) return { error: "Choose a learner." };

  const supabase = await createClient();
  // The placement hangs off an enrolment; use the learner's current active one.
  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id")
    .eq("learner_id", learnerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!enrolment) return { error: "That learner has no active enrolment. Approve one in the Enrolment queue first." };

  const { error } = await supabase
    .from("class_enrolments")
    .insert({ class_group_id: classId, learner_id: learnerId, enrolment_id: enrolment.id });
  if (error) {
    if (error.code === "23505") return { error: "That learner is already in this class." };
    // The capacity trigger: "Class is full (capacity 6)".
    if (/class is full/i.test(error.message)) return { error: error.message.replace(/^.*?(Class is full)/, "$1") + "." };
    return { error: error.message };
  }
  revalidatePath("/admin/timetable");
  revalidatePath("/admin/learners");
  return { ok: "Learner placed." };
}

/** Take a learner out of a class. The placement is closed, not deleted, so attendance history stays. */
export async function withdrawPlacement(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  await requireRole("admin");
  const placementId = text(formData, "placement_id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("class_enrolments")
    .update({ left_on: new Date().toISOString().slice(0, 10) })
    .eq("id", placementId)
    .is("left_on", null);
  if (error) return { error: error.message };
  revalidatePath("/admin/timetable");
  revalidatePath("/admin/learners");
  return { ok: "Learner removed from the class." };
}
