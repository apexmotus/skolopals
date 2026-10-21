"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type ApproveState = { error?: string; ok?: string };

/**
 * Approve an enrolment. The RPC does it in one transaction: activates the
 * enrolment, opens a billing account if needed, and raises the once-off
 * registration invoice (SPEC rule 6b).
 */
export async function approveEnrolment(_prev: ApproveState, formData: FormData): Promise<ApproveState> {
  await requireRole("admin");

  const id = String(formData.get("enrolment_id") ?? "");
  const tutorId = String(formData.get("assigned_tutor_id") ?? "");
  const startDate = String(formData.get("start_date") ?? "");
  const firstMonth = String(formData.get("first_month_rand") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id || !tutorId || !startDate) return { error: "Choose a tutor and a start date." };

  let cents: number | null = null;
  if (firstMonth !== "") {
    const rand = Number(firstMonth);
    if (!Number.isFinite(rand) || rand < 0) return { error: "Enter the first month as a number of Rand." };
    cents = Math.round(rand * 100);
    if (!reason) return { error: "Give a reason when you set a first-month amount." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_enrolment", {
    p_enrolment_id: id,
    p_assigned_tutor_id: tutorId,
    p_start_date: startDate,
    p_first_month_cents: cents,
    p_reason: reason || null,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  revalidatePath("/admin/enrolments");
  return { ok: "Enrolment activated and the registration invoice raised." };
}

export async function declineEnrolment(_prev: ApproveState, formData: FormData): Promise<ApproveState> {
  await requireRole("admin");
  const id = String(formData.get("enrolment_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("enrolments").update({ status: "declined" }).eq("id", id);
  if (error) return { error: "Could not decline the enrolment." };
  revalidatePath("/admin/enrolments");
  return { ok: "Enrolment declined." };
}
