"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getTutorContext } from "@/lib/tutor";

export type ActionState = { error?: string; ok?: boolean };

const STATUSES = ["present", "absent", "late", "excused"] as const;

/** Mark one learner present, absent, late or excused for a session. */
export async function markAttendance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await getTutorContext();
  const sessionId = String(formData.get("session_id") ?? "");
  const learnerId = String(formData.get("learner_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(STATUSES as readonly string[]).includes(status)) return { error: "Unknown attendance status." };

  const supabase = await createClient();
  // RLS allows this only for a session this tutor actually teaches.
  const { error } = await supabase.from("attendance_records").upsert(
    { class_session_id: sessionId, learner_id: learnerId, status, marked_by: profile.id },
    { onConflict: "class_session_id,learner_id" },
  );
  if (error) return { error: "Could not save the register." };

  revalidatePath("/tutor/register");
  return { ok: true };
}

export async function sendMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireRole("tutor");
  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!threadId || !body) return { error: "Write a message first." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .insert({ thread_id: threadId, sender_id: profile.id, body });
  if (error) return { error: "Could not send your message." };

  revalidatePath("/tutor/messages");
  return { ok: true };
}
