"use server";

import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: boolean; values?: Record<string, string> };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const SOURCES = ["website", "whatsapp", "facebook", "walk_in", "phone", "referral", "flyer", "other"] as const;

export async function sendEnquiry(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    full_name: text(formData, "full_name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    topic: text(formData, "topic"),
    message: text(formData, "message"),
  };
  const source = text(formData, "source");

  // Many parents reach the centre by WhatsApp or a flyer and may not have
  // an email address, so a phone number is an acceptable alternative.
  if (!values.full_name || !values.message || (!isEmail(values.email) && !values.phone)) {
    return { error: "Add your name, a message, and either an email address or a phone number.", values };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_enquiries").insert({
    ...values,
    source: (SOURCES as readonly string[]).includes(source) ? source : "website",
  });
  if (error) return { error: "We couldn’t send your message. Please try again.", values };
  return { ok: true };
}
