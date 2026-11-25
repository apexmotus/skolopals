"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@skolopals/shared/supabase/server";
import { requireRole } from "@skolopals/shared/auth";
import { todayAtCentre } from "@skolopals/shared/format";
import { getTutorContext } from "@/lib/tutor";
import * as door from "@skolopals/shared/door";

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
  // A register is marked on the day of the session or after it, never ahead of time.
  const { data: session } = await supabase
    .from("class_sessions")
    .select("session_date, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: "Could not find that session." };
  if (session.session_date > todayAtCentre()) {
    return { error: "This session hasn't happened yet. Mark the register on the day." };
  }
  if (session.status === "cancelled") return { error: "This session was cancelled, so there is no register to mark." };

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

// The door (in-centre sessions). The shared functions write as this tutor; the database only
// lets them run the door for sessions they teach.
export async function doorSignIn(_prev: door.DoorState, formData: FormData): Promise<door.DoorState> {
  await getTutorContext();
  const result = await door.signIn(formData);
  revalidatePath("/tutor/register");
  return result;
}

export async function doorSignOut(_prev: door.DoorState, formData: FormData): Promise<door.DoorState> {
  await getTutorContext();
  const result = await door.signOut(formData);
  revalidatePath("/tutor/register");
  return result;
}

export async function doorUndo(_prev: door.DoorState, formData: FormData): Promise<door.DoorState> {
  await getTutorContext();
  const result = await door.undoSignOut(formData);
  revalidatePath("/tutor/register");
  return result;
}

/** Online and hybrid sessions: the tutor confirms every learner's status at once, from the join list. */
export async function confirmOnlineRegister(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await getTutorContext();
  const sessionId = String(formData.get("session_id") ?? "");
  const rows = [...formData.entries()]
    .filter(([key]) => key.startsWith("status_"))
    .map(([key, value]) => ({ learnerId: key.slice("status_".length), status: String(value) }));
  if (rows.length === 0) return { error: "There is nobody to mark." };
  if (rows.some((r) => !(STATUSES as readonly string[]).includes(r.status))) return { error: "Choose a status for everyone." };

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("class_sessions")
    .select("session_date, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: "Could not find that session." };
  if (session.session_date > todayAtCentre()) return { error: "This session hasn't happened yet." };
  if (session.status === "cancelled") return { error: "This session was cancelled, so there is no register to mark." };

  // RLS allows this only for a session this tutor actually teaches.
  const { error } = await supabase.from("attendance_records").upsert(
    rows.map((r) => ({
      class_session_id: sessionId,
      learner_id: r.learnerId,
      status: r.status,
      marked_by: profile.id,
      marked_at: new Date().toISOString(),
    })),
    { onConflict: "class_session_id,learner_id" },
  );
  if (error) return { error: "Could not save the register." };

  revalidatePath("/tutor/register");
  return { ok: true };
}
