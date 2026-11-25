import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button, Card, CardTitle, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { dateTime, relativeDay } from "@skolopals/shared/format";
import { getAttention, getUpdates, type Portal } from "@/lib/notifications";
import { markAllUpdatesRead } from "./actions";

/** Everything waiting on this person, each linking to where they deal with it. Shared by all three portals. */
export async function NotificationsView({ portal }: { portal: Portal }) {
  const [items, updates] = await Promise.all([getAttention(portal), getUpdates()]);

  return (
    <>
      <PageHeading title="Notifications" description="What needs your attention, and updates from the centre." />

      {items.length === 0 && updates.length === 0 ? (
        <EmptyState title="You’re all caught up" description="Nothing needs your attention right now." />
      ) : null}

      {items.length > 0 ? (
        <Card>
          <CardTitle>Needs your attention</CardTitle>
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.id} className="border-t border-line first:border-t-0">
                <Link href={item.href} className="-mx-2 flex items-center gap-3 rounded-[8px] px-2 py-3 hover:bg-white/[0.04]">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[13px] font-semibold text-ink">{item.title}</span>
                    {item.detail ? <span className="truncate text-[12px] text-muted">{item.detail}</span> : null}
                    {item.at ? <span className="text-[11px] text-muted">{relativeDay(item.at)}</span> : null}
                  </span>
                  <ChevronRight aria-hidden size={18} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {updates.length > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Updates from the centre</CardTitle>
            <form action={markAllUpdatesRead}>
              <Button type="submit" variant="secondary">
                Mark as read
              </Button>
            </form>
          </div>
          <ul className="flex flex-col gap-3">
            {updates.map((u) => (
              <li key={u.id} className="flex flex-col gap-1 border-t border-line pt-3 first:border-t-0 first:pt-0">
                <span className="text-[13px] font-semibold text-ink">{u.title}</span>
                <span className="whitespace-pre-line text-[13px] leading-[1.6] text-muted">{u.body}</span>
                <span className="text-[12px] text-muted">{dateTime(u.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
