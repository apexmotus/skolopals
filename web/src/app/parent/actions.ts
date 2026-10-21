"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type ActionState = { error?: string; ok?: boolean };

/** Post a message into a thread the guardian is a participant of. */
export async function sendMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireRole("parent");
  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!threadId || !body) return { error: "Write a message first." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .insert({ thread_id: threadId, sender_id: profile.id, body });
  if (error) return { error: "Could not send your message." };

  revalidatePath("/parent/messages");
  return { ok: true };
}

/** Acknowledge a published termly report - the last step of the value chain. */
export async function acknowledgeReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireRole("parent");
  const reportId = String(formData.get("report_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  if (!reportId) return { error: "Missing report." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("report_acknowledgements")
    .insert({ progress_report_id: reportId, guardian_id: profile.id, comment });
  if (error) return { error: "Could not record your acknowledgement." };

  revalidatePath("/parent/progress");
  return { ok: true };
}
