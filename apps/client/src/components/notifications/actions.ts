"use server";

import { revalidatePath } from "next/cache";
import { requireClientRole } from "@skolopals/shared/auth";
import { createClient } from "@skolopals/shared/supabase/server";
import { attentionCount, type Portal } from "@/lib/notifications";

/** The bell asks again on every page change: layouts do not re-render on navigation. */
export async function refreshAttentionCount(portal: Portal): Promise<number> {
  await requireClientRole(portal);
  return attentionCount(portal);
}

/** Marks every centre update as read. RLS ("notification_recipients: own mark read") limits it to the caller's own. */
export async function markAllUpdatesRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notification_recipients").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
}
