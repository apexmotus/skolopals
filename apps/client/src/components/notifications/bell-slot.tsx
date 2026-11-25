import { Suspense } from "react";
import { attentionCount, type Portal } from "@/lib/notifications";
import { NotificationBell } from "./notification-bell";

/** The bell for AppShell, with its first count rendered on the server. */
export async function BellSlot({ portal }: { portal: Portal }) {
  const count = await attentionCount(portal);
  return (
    <Suspense fallback={<NotificationBell portal={portal} initialCount={count} />}>
      <NotificationBell portal={portal} initialCount={count} />
    </Suspense>
  );
}
