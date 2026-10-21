"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type ActionState = { error?: string; ok?: boolean };

/** Mark an enquiry as contacted, enrolled or closed. */
export async function setEnquiryStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["new", "contacted", "enrolled", "closed"].includes(status)) return { error: "Unknown status." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { error } = await supabase
    .from("contact_enquiries")
    .update({ status, handled_by: claims?.claims?.sub ?? null, handled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Could not update the enquiry." };

  revalidatePath("/admin/enquiries");
  return { ok: true };
}

/** Suspend or reactivate a tutor. */
export async function setTutorStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["active", "suspended", "inactive"].includes(status)) return { error: "Unknown status." };

  const supabase = await createClient();
  const { error } = await supabase.from("tutors").update({ status }).eq("id", id);
  if (error) return { error: "Could not update the tutor." };

  revalidatePath("/admin/tutors");
  return { ok: true };
}
