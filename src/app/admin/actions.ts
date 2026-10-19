"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { TutorStatus } from "@/lib/database.types";

export async function decideApplication(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("application_id") ?? "");
  const decision = String(formData.get("decision") ?? "") as TutorStatus;
  const requested = formData.getAll("requested").map(String);
  const message = String(formData.get("note") ?? "").trim().slice(0, 2000);
  const note = requested.length ? `Please provide: ${requested.join(", ")}.${message ? ` ${message}` : ""}` : message;

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_application", { p_application_id: id, p_decision: decision, p_notes: note });
  if (error) redirect(`/admin/applications/${id}?error=1`);
  revalidatePath("/admin", "layout");

  if (decision === "approved") redirect(`/admin/applications/${id}/approved`);
  if (decision === "declined") redirect(`/admin/applications/${id}/declined`);
  redirect(`/admin/applications/${id}?requested=1`);
}

export async function setTutorStatus(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("tutor_id") ?? "");
  const status = formData.get("status") === "suspended" ? "suspended" : "approved";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);

  const supabase = await createClient();
  const { data: tutor } = await supabase.from("tutors").update({ status }).eq("id", id).select("profile_id").single();
  if (tutor?.profile_id) {
    await supabase.from("notifications").insert({
      user_id: tutor.profile_id,
      title: status === "suspended" ? "Your tutor account is suspended" : "Your tutor account is active again",
      body: reason,
    });
  }
  revalidatePath("/admin/tutors", "layout");
  redirect(`/admin/tutors/${id}`);
}
