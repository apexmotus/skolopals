import "server-only";
import { createClient } from "@skolopals/shared/supabase/server";

export type PaymentContext = {
  invoice: { id: string; number: string; totalCents: number; balanceCents: number; dueOn: string | null };
  lines: { id: string; description: string; amountCents: number }[];
  settings: { payshapId: string; accountName: string; bankName: string; instructions: string } | null;
  /** The latest submission for this invoice; the dialog's step is derived from it (SPEC §3.1). */
  submission: {
    id: string;
    status: "awaiting_proof" | "submitted" | "verified" | "rejected" | "withdrawn";
    rejectionReason: string | null;
    claimedAmountCents: number | null;
    proofUploadedAt: string | null;
  } | null;
};

/** Everything the PayShap dialog shows for one invoice. RLS limits it to the account holder. */
export async function getPaymentContext(invoiceId: string): Promise<PaymentContext | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: invoice }, { data: lines }, { data: settings }, { data: submission }] = await Promise.all([
    supabase.from("v_invoice_status").select("id, invoice_number, total_cents, balance_cents, due_on").eq("id", invoiceId).maybeSingle(),
    supabase.from("invoice_lines").select("id, description, line_total_cents").eq("invoice_id", invoiceId).order("line_type"),
    supabase
      .from("payment_settings")
      .select("payshap_id, account_name, bank_name, instructions")
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gt.${today}`)
      .maybeSingle(),
    supabase
      .from("payment_submissions")
      .select("id, status, rejection_reason, claimed_amount_cents, proof_uploaded_at")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!invoice?.id) return null;

  return {
    invoice: {
      id: invoice.id,
      number: invoice.invoice_number ?? "",
      totalCents: Number(invoice.total_cents ?? 0),
      balanceCents: Number(invoice.balance_cents ?? 0),
      dueOn: invoice.due_on,
    },
    lines: (lines ?? []).map((l) => ({ id: l.id, description: l.description, amountCents: l.line_total_cents ?? 0 })),
    settings: settings
      ? {
          payshapId: settings.payshap_id,
          accountName: settings.account_name,
          bankName: settings.bank_name,
          instructions: settings.instructions,
        }
      : null,
    submission: submission
      ? {
          id: submission.id,
          status: submission.status as NonNullable<PaymentContext["submission"]>["status"],
          rejectionReason: submission.rejection_reason,
          claimedAmountCents: submission.claimed_amount_cents,
          proofUploadedAt: submission.proof_uploaded_at,
        }
      : null,
  };
}
