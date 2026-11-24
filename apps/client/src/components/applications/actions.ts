"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@skolopals/shared/api";
import { createClient } from "@skolopals/shared/supabase/server";

export type ActionResult = { ok?: true; error?: string };

/** Replace the report card while the application waits for review, e.g. after "please send a clearer copy". */
export async function replaceReportCard(
  enrolmentId: string,
  card: { path: string; mimeType: string; sizeBytes: number; originalName: string; year?: number; term?: number },
): Promise<ActionResult> {
  try {
    await api.put(`/enrolments/${enrolmentId}/report-card`, card);
    revalidatePath("/parent");
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof ApiError && err.status < 500 ? err.message : "We could not replace the report card. Please try again.",
    };
  }
}

/** Marks every update as read. RLS ("notification_recipients: own mark read") limits it to the caller's own. */
export async function markUpdatesRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notification_recipients").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/parent");
}
