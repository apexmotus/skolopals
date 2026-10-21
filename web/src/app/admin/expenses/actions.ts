"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type ExpenseState = { error?: string; ok?: string };

export async function recordExpense(_prev: ExpenseState, formData: FormData): Promise<ExpenseState> {
  await requireRole("admin");
  const category = String(formData.get("category_code") ?? "");
  const rand = Number(String(formData.get("amount_rand") ?? ""));
  const incurredOn = String(formData.get("incurred_on") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  if (!category) return { error: "Choose a category." };
  if (!Number.isFinite(rand) || rand <= 0) return { error: "Enter the amount in Rand." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { error } = await supabase.from("expenses").insert({
    category_code: category,
    amount_cents: Math.round(rand * 100),
    incurred_on: incurredOn || new Date().toISOString().slice(0, 10),
    description,
    recorded_by: claims?.claims?.sub ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/reports");
  return { ok: "Expense recorded." };
}
