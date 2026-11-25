"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import type { Portal } from "@/lib/notifications";
import { refreshAttentionCount } from "./actions";

export function NotificationBell({ portal, initialCount }: { portal: Portal; initialCount: number }) {
  // Search params too: opening another thread only changes `?thread=`.
  const location = `${usePathname()}?${useSearchParams()}`;
  const [count, setCount] = useState(initialCount);

  // A server action that re-renders the layout sends a fresh count down.
  const [lastInitial, setLastInitial] = useState(initialCount);
  if (initialCount !== lastInitial) {
    setLastInitial(initialCount);
    setCount(initialCount);
  }

  useEffect(() => {
    let live = true;
    refreshAttentionCount(portal)
      .then((n) => {
        if (live) setCount(n);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [portal, location]);

  return (
    <Link
      href={`/${portal}/notifications`}
      // The count is things to do plus unread updates, so "new" fits both.
      aria-label={count > 0 ? `Notifications, ${count} new` : "Notifications"}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/[0.09]"
    >
      <Bell aria-hidden size={20} strokeWidth={1.5} />
      {count > 0 ? (
        <span className="absolute right-1 top-1 min-w-[18px] rounded-full bg-sun px-1 text-center text-[11px] font-bold leading-[18px] text-plum-950">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
