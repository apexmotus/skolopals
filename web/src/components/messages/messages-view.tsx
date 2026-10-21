import { Badge, Card, CardTitle, EmptyState } from "@/components/ui";
import { ReplyForm } from "./message-forms";
import { getThread, getThreads } from "@/lib/messages";
import { dateTime, initials, relativeDay } from "@/lib/format";

/** The conversation list plus one open thread. Shared by all three portals. */
export async function MessagesView({ openThreadId }: { openThreadId?: string }) {
  const threads = await getThreads();
  if (threads.length === 0) {
    return (
      <EmptyState
        title="No conversations yet"
        description="Start one above, or wait for the centre to get in touch."
      />
    );
  }

  const current = openThreadId ?? threads[0]?.id ?? undefined;
  const { thread, messages } = current
    ? await getThread(current)
    : { thread: null, messages: [] };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-col gap-2 lg:w-[280px]">
        {threads.map((t) => (
          <a
            key={t.id}
            href={`?thread=${t.id}`}
            className={`flex flex-col gap-1 rounded-[8px] border p-3 ${
              t.id === current ? "border-brand bg-canvas" : "border-line bg-white"
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-ink">{t.subject}</span>
              {Number(t.unread_count ?? 0) > 0 ? (
                <Badge tone="brand">{String(t.unread_count)}</Badge>
              ) : null}
            </span>
            {t.learner_name ? (
              <span className="text-[11px] text-muted">About {t.learner_name}</span>
            ) : null}
            <span className="truncate text-[11px] text-muted">{t.last_message}</span>
            <span className="text-[10px] text-muted">
              {t.last_message_at ? relativeDay(t.last_message_at) : ""}
            </span>
          </a>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <Card>
          <CardTitle>{thread?.subject ?? "Conversation"}</CardTitle>
          {thread?.learners?.full_name ? (
            <p className="text-[11px] text-muted">About {thread.learners.full_name}</p>
          ) : null}
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div key={m.id} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-canvas text-[11px] font-bold text-brand">
                  {initials(m.profiles?.full_name ?? "?")}
                </span>
                <div className="flex min-w-0 flex-col gap-[2px]">
                  <span className="text-[12px] font-semibold text-ink">
                    {m.profiles?.full_name ?? "Someone"}
                    <span className="pl-2 font-normal text-muted">{dateTime(m.created_at)}</span>
                  </span>
                  <p className="whitespace-pre-wrap text-[13px] leading-[1.5] text-black">{m.body}</p>
                </div>
              </div>
            ))}
          </div>
          {current ? <ReplyForm threadId={current} /> : null}
        </Card>
      </div>
    </div>
  );
}
