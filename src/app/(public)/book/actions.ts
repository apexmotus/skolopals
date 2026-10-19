"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseDuration } from "@/lib/booking";

export type CheckoutState = { error?: string; declined?: boolean };

export async function payForLesson(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const slotId = String(formData.get("slot") ?? "");
  const subject = String(formData.get("subject") ?? "").slice(0, 80);
  const goal = String(formData.get("goal") ?? "").slice(0, 300);
  const minutes = parseDuration(formData.get("duration"));
  // Only the last four digits reach the server; the full number never leaves the card field.
  const last4 = String(formData.get("card_last4") ?? "").replace(/\D/g, "").slice(-4);
  const name = String(formData.get("card_name") ?? "").trim();

  if (!name || last4.length !== 4) return { error: "Enter the name on the card and a valid card number." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_lesson", {
    p_slot_id: slotId,
    p_subject: subject,
    p_learning_goal: goal,
    p_duration_minutes: minutes,
    p_card_last4: last4,
  });

  if (error) {
    return { error: error.message.includes("no longer available") ? "Sorry — that time was just booked. Choose another slot." : "We couldn’t complete your booking. Please try again." };
  }
  const result = data?.[0];
  if (!result || result.payment_status === "declined") return { declined: true };

  redirect(`/book/confirmation/${result.booking_id}`);
}
