"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@skolopals/shared/api";
import { requireAdmin } from "@skolopals/shared/auth";
import { createClient } from "@skolopals/shared/supabase/server";
import { getClassFamilyIds } from "@/lib/admin";

export type AnnouncementState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** The profiles an audience reaches. "everyone" is left to the API, which broadcasts it. */
async function recipientsFor(audience: string): Promise<string[]> {
  const supabase = await createClient();

  if (audience === "parents" || audience === "tutors") {
    const role = audience === "parents" ? "parent" : "tutor";
    const { data } = await supabase.from("user_roles").select("user_id").eq("role", role);
    return [...new Set((data ?? []).map((r) => r.user_id))];
  }

  // "class:<id>": the families of that class.
  const classId = audience.startsWith("class:") ? audience.slice("class:".length) : "";
  return classId ? getClassFamilyIds(classId) : [];
}

export async function sendAnnouncement(_prev: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  await requireAdmin();
  const title = text(formData, "title");
  const body = text(formData, "body");
  const audience = text(formData, "audience");

  if (!title) return { error: "Give the announcement a title." };
  if (title.length > 200) return { error: "Keep the title under 200 characters." };
  if (body.length > 2000) return { error: "Keep the message under 2,000 characters." };
  if (!audience) return { error: "Choose who it goes to." };

  let payload: { title: string; body?: string; broadcast?: true; recipientIds?: string[] };
  if (audience === "everyone") {
    payload = { title, body: body || undefined, broadcast: true };
  } else {
    const recipientIds = await recipientsFor(audience);
    if (recipientIds.length === 0) return { error: "Nobody is in that group yet, so there is no one to send it to." };
    payload = { title, body: body || undefined, recipientIds };
  }

  try {
    await api.post("/notifications", payload);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/notifications");
  return { ok: "Announcement sent. It appears in each recipient’s notifications." };
}
