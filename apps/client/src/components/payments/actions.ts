"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@skolopals/shared/api";

export type StartResult = { submissionId?: string; invoiceId?: string; requoted?: boolean; error?: string };
export type ProofResult = { ok?: true; error?: string };

function message(err: unknown, fallback: string) {
  return err instanceof ApiError && err.status < 500 ? err.message : fallback;
}

/** "I have made the payment". An offer invoice from an earlier month comes back re-quoted. */
export async function startPayment(invoiceId: string): Promise<StartResult> {
  try {
    const result = await api.post<{ submissionId: string; invoiceId: string; requoted: boolean }>(
      `/invoices/${invoiceId}/payment-submissions`,
    );
    revalidatePath("/parent", "layout");
    return result;
  } catch (err) {
    return { error: message(err, "We could not start the payment. Please try again.") };
  }
}

export async function submitProof(
  submissionId: string,
  proof: { path: string; mimeType: string; claimedAmountCents?: number; claimedPaidOn?: string; payerReference?: string },
): Promise<ProofResult> {
  try {
    await api.post(`/payment-submissions/${submissionId}/proof`, proof);
    revalidatePath("/parent", "layout");
    return { ok: true };
  } catch (err) {
    return { error: message(err, "We could not send the proof. Please try again.") };
  }
}
