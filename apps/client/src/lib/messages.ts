import "server-only";
import { createClient } from "@skolopals/shared/supabase/server";

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
    // Named FK: message_reads also links messages to profiles, so a bare
    // `profiles(...)` is ambiguous (PGRST201) and returns no messages at all.
    supabase
      .from("messages")
      .select("*, profiles!messages_sender_id_fkey(full_name)")
      .eq("thread_id", threadId)
      .order("created_at"),
    supabase
      .from("thread_participants")
      .select("profile_id, profiles(full_name)")
      .eq("thread_id", threadId),
  ]);
  // profiles RLS hides most people from each other, so the joined names above come back empty
  // for anyone who isn't a tutor. thread_people returns just the names, to the thread's members.
  const { data: people } = await supabase.rpc("thread_people", { p_thread_id: threadId });
  const names = new Map((people ?? []).map((p) => [p.profile_id, p.full_name]));
  return { thread, messages: messages ?? [], participants: participants ?? [], names };
}

/** The "To" value that means every active administrator; startThread expands it. */
export const CENTRE_RECIPIENT = "centre";

/** Who a parent can start a conversation with: the centre, and the tutors who teach their
 * children. RLS limits class placements to the parent's own learners. */
export async function getContactableStaff() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_enrolments")
    .select("class_groups(tutors(profile_id, status, profiles(full_name)))")
    .is("left_on", null);
  const tutors = new Map<string, string>();
  for (const placement of data ?? []) {
    const tutor = placement.class_groups?.tutors;
    if (tutor?.status === "active" && tutor.profile_id && tutor.profiles) {
      tutors.set(tutor.profile_id, tutor.profiles.full_name);
    }
  }
  return [
    { id: CENTRE_RECIPIENT, name: "The centre (Skolopals office)" },
    ...[...tutors].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  ];
}
