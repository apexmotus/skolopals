import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getThreads() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_my_threads")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  return data ?? [];
}

export async function getThread(threadId: string) {
  const supabase = await createClient();
  const [{ data: thread }, { data: messages }, { data: participants }] = await Promise.all([
    supabase.from("message_threads").select("*, learners(full_name)").eq("id", threadId).maybeSingle(),
    supabase
      .from("messages")
      .select("*, profiles(full_name)")
      .eq("thread_id", threadId)
      .order("created_at"),
    supabase
      .from("thread_participants")
      .select("profile_id, profiles(full_name)")
      .eq("thread_id", threadId),
  ]);
  return { thread, messages: messages ?? [], participants: participants ?? [] };
}

/** Who this person can start a conversation with. */
export async function getContactableStaff() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tutors")
    .select("profile_id, profiles(full_name)")
    .eq("status", "active");
  return (data ?? []).flatMap((t) =>
    t.profile_id && t.profiles ? [{ id: t.profile_id, name: t.profiles.full_name }] : [],
  );
}
