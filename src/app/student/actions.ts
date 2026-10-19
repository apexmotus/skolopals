"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function cancelLesson(formData: FormData) {
  await requireUser();
  const id = String(formData.get("booking_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: id });
  if (error) redirect(`/student/bookings/${id}?error=cancel`);
  revalidatePath("/student", "layout");
  redirect(`/student/bookings/${id}?cancelled=1`);
}

export type MessageState = { error?: string };

export async function sendMessage(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const profile = await requireUser();
  const recipient = String(formData.get("recipient_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a message first." };
  if (body.length > 4000) return { error: "Messages can be up to 4,000 characters." };

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ sender_id: profile.id, recipient_id: recipient, body });
  if (error) return { error: "We couldn’t send that message. Please try again." };
  revalidatePath(`/${profile.role}/messages`);
  return {};
}
