"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@skolopals/shared/api";
import { requireAdmin } from "@skolopals/shared/auth";
import { createClient } from "@skolopals/shared/supabase/server";
import { dateTime } from "@skolopals/shared/format";
import { getClassFamilyIds } from "@/lib/admin";

export type SessionState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function getSession(sessionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_sessions")
    .select(
      "id, starts_at, status, tutor_id, class_group_id, class_groups(name, subject_code, language_code, tutors(profile_id), class_group_grades(grade_code))",
    )
    .eq("id", sessionId)
    .maybeSingle();
  return data;
}

/** In-portal notifications only. A failure here must not undo the change already saved. */
async function notify(recipientIds: string[], title: string, body: string) {
  if (recipientIds.length === 0) return true;
  try {
    await api.post("/notifications", { title, body, recipientIds });
    return true;
  } catch (error) {
    if (error instanceof ApiError) return false;
    throw error;
  }
}

function refresh() {
  revalidatePath("/admin/sessions");
  revalidatePath("/admin/timetable");
}

export async function cancelSession(_prev: SessionState, formData: FormData): Promise<SessionState> {
  await requireAdmin();
  const session = await getSession(text(formData, "session_id"));
  if (!session) return { error: "Could not find that session." };
  const reason = text(formData, "reason");
  if (!reason) return { error: "Say why it is cancelled. Families see this." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_sessions")
    .update({ status: "cancelled", notes: reason })
    .eq("id", session.id);
  if (error) return { error: "Could not cancel the session." };
  refresh();

  if (formData.get("notify") !== "on") return { ok: "Session cancelled." };
  const className = session.class_groups?.name ?? "Class";
  const teaching = session.tutor_id
    ? (await supabase.from("tutors").select("profile_id").eq("id", session.tutor_id).maybeSingle()).data?.profile_id
    : session.class_groups?.tutors?.profile_id;
  const recipients = [...(await getClassFamilyIds(session.class_group_id)), ...(teaching ? [teaching] : [])];
  const sent = await notify(recipients, `Cancelled: ${className}, ${dateTime(session.starts_at)}`, reason);
  return sent
    ? { ok: "Session cancelled, and the families and tutor have been told." }
    : { error: "Session cancelled, but the notification could not be sent. Send an announcement instead." };
}

export async function reinstateSession(_prev: SessionState, formData: FormData): Promise<SessionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("class_sessions")
    .update({ status: "scheduled", notes: "" })
    .eq("id", text(formData, "session_id"));
  if (error) return { error: "Could not reinstate the session." };
  refresh();
  return { ok: "Session back on. If families were told it was cancelled, let them know it is on again." };
}

/** Covers one session with another tutor, who must teach the subject at every grade, in the class's language. */
export async function setSubstitute(_prev: SessionState, formData: FormData): Promise<SessionState> {
  await requireAdmin();
  const session = await getSession(text(formData, "session_id"));
  if (!session?.class_groups) return { error: "Could not find that session." };
  const tutorId = text(formData, "tutor_id") || null;
  const supabase = await createClient();

  let substitute: { profile_id: string | null; profiles: { full_name: string } | null } | null = null;
  if (tutorId) {
    const cls = session.class_groups;
    const grades = (cls.class_group_grades ?? []).map((g) => g.grade_code);
    const { data: competencies } = await supabase
      .from("tutor_competencies")
      .select("grade_code, tutor_competency_media(language_code)")
      .eq("tutor_id", tutorId)
      .eq("subject_code", cls.subject_code);
    const covered = new Set(
      (competencies ?? [])
        .filter((c) => (c.tutor_competency_media ?? []).some((m) => m.language_code === cls.language_code))
        .map((c) => c.grade_code),
    );
    if (!grades.every((g) => covered.has(g))) {
      return { error: "That tutor isn’t recorded as teaching this subject, at these grades, in this language." };
    }
    substitute = (await supabase.from("tutors").select("profile_id, profiles(full_name)").eq("id", tutorId).maybeSingle()).data;
  }

  const { error } = await supabase.from("class_sessions").update({ tutor_id: tutorId }).eq("id", session.id);
  if (error) return { error: "Could not save the substitute." };
  refresh();

  if (!substitute?.profile_id) return { ok: "Substitute removed. The class’s own tutor teaches this session." };
  const sent = await notify(
    [substitute.profile_id],
    `You’re covering ${session.class_groups.name}`,
    `${dateTime(session.starts_at)}. It is in your schedule and attendance register.`,
  );
  const who = substitute.profiles?.full_name ?? "The substitute";
  return sent
    ? { ok: `${who} is covering this session and has been told.` }
    : { error: `${who} is covering this session, but the notification could not be sent. Let them know directly.` };
}
