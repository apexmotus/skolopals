"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@skolopals/shared/auth";
import { createClient } from "@skolopals/shared/supabase/server";

export type JoinState = { error?: string };

const clean = (m: string) => m.replace(/^.*?:\s*/, "");

/** Records that this learner opened the class, then sends them to the meeting. */
export async function joinSession(_prev: JoinState, formData: FormData): Promise<JoinState> {
  await requireUser();
  const supabase = await createClient();
  const { data: meetingUrl, error } = await supabase.rpc("join_session", {
    p_session_id: String(formData.get("session_id") ?? ""),
    p_learner_id: String(formData.get("learner_id") ?? ""),
  });
  if (error || !meetingUrl) return { error: error ? clean(error.message) : "Could not open the class." };
  redirect(meetingUrl);
}
