"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export type MessageState = { error?: string; ok?: boolean };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const clean = (m: string) => m.replace(/^.*?:\s*/, "");

export async function startThread(_prev: MessageState, formData: FormData): Promise<MessageState> {
  await requireUser();
  const subject = text(formData, "subject");
  const body = text(formData, "body");
  const learnerId = text(formData, "learner_id");
  const participants = formData.getAll("participant").map(String).filter(Boolean);

  if (!body) return { error: "Write a message first." };
  if (participants.length === 0) return { error: "Choose who to send it to." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_thread", {
    p_subject: subject,
    p_body: body,
    p_participants: participants,
    p_learner_id: learnerId || null,
  });
  if (error) return { error: clean(error.message) };

  revalidatePath("/parent/messages");
  revalidatePath("/tutor/messages");
  revalidatePath("/learner/messages");
  return { ok: true };
}

export async function replyToThread(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const { profile } = await requireUser();
  const threadId = text(formData, "thread_id");
  const body = text(formData, "body");
  if (!body) return { error: "Write a message first." };

  const supabase = await createClient();
  // RLS allows this only if the sender is already a participant.
  const { error } = await supabase
    .from("messages")
    .insert({ thread_id: threadId, sender_id: profile.id, body });
  if (error) return { error: clean(error.message) };

  revalidatePath("/parent/messages");
  revalidatePath("/tutor/messages");
  revalidatePath("/learner/messages");
  return { ok: true };
}

export async function markRead(threadId: string) {
  await requireUser();
  const supabase = await createClient();
  await supabase.rpc("mark_thread_read", { p_thread_id: threadId });
}
