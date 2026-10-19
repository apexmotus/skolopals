"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutorListing } from "@/lib/tutor";
import { requireRole } from "@/lib/auth";

export type SlotState = { error?: string; ok?: string };

/** Adds a slot at a UK-local date/time (the marketplace timezone). */
export async function addSlot(_prev: SlotState, formData: FormData): Promise<SlotState> {
  const { tutor } = await requireTutorListing();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Choose a date and time." };

  const local = `${date} ${time}`;
  const startsAt = toLondonIso(local);
  if (new Date(startsAt) <= new Date()) return { error: "Pick a time in the future." };

  const supabase = await createClient();
  const { error } = await supabase.from("availability_slots").insert({ tutor_id: tutor.id, starts_at: startsAt });
  if (error) return { error: error.code === "23505" ? "You already have that slot." : "Couldn’t add that slot." };
  revalidatePath("/tutor/schedule");
  return { ok: `Added ${local}.` };
}

export async function removeSlot(formData: FormData) {
  await requireTutorListing();
  const supabase = await createClient();
  await supabase.from("availability_slots").delete().eq("id", String(formData.get("slot_id"))).eq("is_booked", false);
  revalidatePath("/tutor/schedule");
}

export async function resubmitApplication(formData: FormData) {
  const profile = await requireRole("tutor");
  const id = String(formData.get("application_id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  const documents = formData
    .getAll("documents")
    .map(String)
    .filter((p) => /^applications\/[0-9a-f-]{36}\/[\w.-]+$/.test(p));

  const supabase = await createClient();
  const { data: app } = await supabase.from("tutor_applications").select("documents, experience").eq("id", id).eq("user_id", profile.id).single();
  if (!app) redirect("/tutor/application");
  await supabase
    .from("tutor_applications")
    .update({
      status: "pending",
      documents: [...app.documents, ...documents],
      experience: note ? `${app.experience}\n\nUpdate: ${note}` : app.experience,
    })
    .eq("id", id);
  revalidatePath("/tutor/application");
  redirect("/tutor/application");
}

// Convert a wall-clock time in Europe/London (GMT or BST) to an ISO instant.
function toLondonIso(local: string) {
  const [d, t] = local.split(" ");
  const asUtc = new Date(`${d}T${t}:00Z`);
  const londonOffsetMin =
    (new Date(asUtc.toLocaleString("en-US", { timeZone: "Europe/London" })).getTime() -
      new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" })).getTime()) /
    60_000;
  return new Date(asUtc.getTime() - londonOffsetMin * 60_000).toISOString();
}
