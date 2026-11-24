"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, ApiError } from "@skolopals/shared/api";
import { requireRole } from "@skolopals/shared/auth";

export type ReviewState = { error?: string };

function message(err: unknown, fallback: string) {
  return err instanceof ApiError && err.status < 500 ? err.message : fallback;
}

/**
 * Verify (SPEC §3.2). For an offer invoice the API also activates the
 * enrolment, places the learner and bills any month now due, in one go.
 * Verifying twice is refused with who did it and when.
 */
export async function verifyPayment(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  await requireRole("admin");
  const id = String(formData.get("submission_id") ?? "");
  const rand = Number(String(formData.get("amount") ?? "").replace(",", "."));
  const paidOn = String(formData.get("paid_on") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();
  if (!Number.isFinite(rand) || rand <= 0) return { error: "Enter the amount received, in rand." };

  let activated = false;
  try {
    const result = await api.post<{ activated: boolean }>(`/payment-submissions/${id}/verify`, {
      amountCents: Math.round(rand * 100),
      paidOn: paidOn || undefined,
      reference: reference || undefined,
    });
    activated = result.activated;
  } catch (err) {
    return { error: message(err, "Could not verify the payment.") };
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/payments?done=${activated ? "activated" : "verified"}`);
}

export async function rejectPayment(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  await requireRole("admin");
  const id = String(formData.get("submission_id") ?? "");
  const choice = String(formData.get("reason") ?? "");
  const reason = choice === "other" ? String(formData.get("reason_other") ?? "").trim() : choice;
  if (!reason) return { error: "Choose a reason, or describe it under Other." };
  try {
    await api.post(`/payment-submissions/${id}/reject`, { reason });
  } catch (err) {
    return { error: message(err, "Could not reject the payment.") };
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/payments?done=rejected");
}
