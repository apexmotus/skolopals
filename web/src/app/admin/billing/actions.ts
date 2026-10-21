"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type BillingState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const clean = (m: string) => m.replace(/^.*?:\s*/, "");

/** The 15th run. Safe to repeat: a month already billed is never billed twice. */
export async function runInvoices(_prev: BillingState, formData: FormData): Promise<BillingState> {
  await requireRole("admin");
  const period = text(formData, "period");
  if (!period) return { error: "Choose the month to bill." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_monthly_invoices", { p_period: `${period}-01` });
  if (error) return { error: clean(error.message) };

  const rows = (data ?? []) as { invoice_id: string; total_cents: number }[];
  if (rows.length === 0) {
    return { ok: "Nothing to bill — every active enrolment is already invoiced for that month." };
  }
  const total = rows.reduce((sum, r) => sum + Number(r.total_cents ?? 0), 0);
  revalidatePath("/admin/billing");
  return { ok: `${rows.length} invoice(s) raised, R${(total / 100).toFixed(2)} in total.` };
}

export async function applyLateFees(_prev: BillingState, formData: FormData): Promise<BillingState> {
  await requireRole("admin");
  // "As at" a date, so the grace period can be checked against a past day
  // when a run was missed.
  const asAt = text(formData, "as_at");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_late_fees", asAt ? { p_on: asAt } : {});
  if (error) return { error: clean(error.message) };
  revalidatePath("/admin/billing");
  return {
    ok: data === 0 ? "No account is past its grace period." : `${data} late fee(s) charged.`,
  };
}

export async function recordPayment(_prev: BillingState, formData: FormData): Promise<BillingState> {
  await requireRole("admin");
  const account = text(formData, "billing_account_id");
  const rand = Number(text(formData, "amount_rand"));
  const method = text(formData, "method");
  const reference = text(formData, "reference");
  const paidOn = text(formData, "paid_on");

  if (!account) return { error: "Choose the family." };
  if (!Number.isFinite(rand) || rand <= 0) return { error: "Enter the amount in Rand." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_payment", {
    p_billing_account_id: account,
    p_amount_cents: Math.round(rand * 100),
    p_method: method || "eft",
    p_reference: reference,
    p_paid_on: paidOn || new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: clean(error.message) };

  revalidatePath("/admin/billing");
  return { ok: "Payment recorded and allocated to the oldest unpaid invoice first." };
}
