import Link from "next/link";
import { ButtonLink, Card, CardTitle, PageHeading, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { relativeDay } from "@/lib/format";
import type { Profile } from "@/lib/database.types";
import { MessageComposer } from "./message-composer";

type Conversation = { id: string; name: string; unread: number; lastAt: string | null };

async function loadConversations(profile: Profile) {
  const supabase = await createClient();
  const [{ data: messages }, { data: bookings }] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order("created_at", { ascending: true })
      .limit(500),
    supabase
      .from("bookings")
      .select("student_id, tutors(profile_id, full_name), profiles!bookings_student_id_fkey(id, full_name)")
      .neq("status", "cancelled"),
  ]);

  const convos = new Map<string, Conversation>();
  // Everyone you have a lesson with can be messaged, even before the first message.
  for (const b of bookings ?? []) {
    const other =
      profile.role === "student"
        ? b.tutors?.profile_id && { id: b.tutors.profile_id, name: b.tutors.full_name }
        : b.profiles && { id: b.profiles.id, name: b.profiles.full_name };
    if (other && !convos.has(other.id)) convos.set(other.id, { ...other, unread: 0, lastAt: null });
  }
  for (const m of messages ?? []) {
    const otherId = m.sender_id === profile.id ? m.recipient_id : m.sender_id;
    const c = convos.get(otherId) ?? { id: otherId, name: "Skolopals support", unread: 0, lastAt: null };
    c.lastAt = m.created_at;
    if (m.recipient_id === profile.id && !m.read_at) c.unread += 1;
    convos.set(otherId, c);
  }
  const list = [...convos.values()].sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return { list, messages: messages ?? [] };
}

export async function MessagesView({ profile, withId }: { profile: Profile; withId?: string }) {
  const { list, messages } = await loadConversations(profile);
  const active = list.find((c) => c.id === withId) ?? list[0];
  const thread = active ? messages.filter((m) => m.sender_id === active.id || m.recipient_id === active.id) : [];
  const base = `/${profile.role}/messages`;

  if (active) {
    // Mark the open thread as read.
    const unreadIds = thread.filter((m) => m.recipient_id === profile.id && !m.read_at).map((m) => m.id);
    if (unreadIds.length) {
      const supabase = await createClient();
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    }
  }

  return (
    <>
      <PageHeading title="Messages" description="Keep lesson conversations in one place." />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="w-full shrink-0 lg:w-[300px]">
          <CardTitle>Conversations</CardTitle>
          {list.length === 0 ? (
            <>
              <p className="text-[12px] text-muted">No conversations yet.</p>
              {profile.role === "student" ? (
                <ButtonLink href="/tutors" variant="secondary" className="w-fit">
                  Find a tutor
                </ButtonLink>
              ) : null}
            </>
          ) : (
            list.map((c) => (
              <Link
                key={c.id}
                href={`${base}?with=${c.id}`}
                aria-current={c.id === active?.id || undefined}
                className={cx("text-[12px] text-ink hover:text-brand", c.id === active?.id && "font-semibold")}
              >
                {c.name} · {c.unread ? `${c.unread} new` : c.lastAt ? relativeDay(c.lastAt) : "No messages yet"}
              </Link>
            ))
          )}
        </Card>

        <Card className="min-w-0 flex-1">
          {!active ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-[20px] font-bold text-ink">No messages yet</p>
              <p className="max-w-[380px] text-[12px] text-muted">
                {profile.role === "student"
                  ? "Book a lesson to start a conversation with your tutor. Messages about your lessons will appear here."
                  : "When students book you, you can message them here about their lessons."}
              </p>
              {profile.role === "student" ? <ButtonLink href="/tutors">Book a lesson</ButtonLink> : null}
            </div>
          ) : (
            <>
              <CardTitle>{active.name}</CardTitle>
              {thread.length === 0 ? (
                <div className="flex flex-col gap-1 rounded-[8px] bg-canvas p-[14px]">
                  <p className="text-[13px] font-semibold text-ink">Start the conversation</p>
                  <p className="text-[12px] text-muted">Say hello and share what you’d like to focus on in your next lesson.</p>
                </div>
              ) : (
                <div className="flex max-h-[480px] flex-col gap-[10px] overflow-y-auto">
                  {thread.map((m) => (
                    <p
                      key={m.id}
                      className={cx("text-[12px]", m.sender_id === profile.id ? "self-end text-right text-black" : "text-muted")}
                    >
                      {m.body}
                    </p>
                  ))}
                </div>
              )}
              <MessageComposer recipientId={active.id} />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
