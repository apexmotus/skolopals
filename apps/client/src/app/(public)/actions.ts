"use server";

import { createClient } from "@skolopals/shared/supabase/server";

export type FormState = { error?: string; ok?: boolean; values?: Record<string, string> };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const SOURCES = ["website", "whatsapp", "facebook", "walk_in", "phone", "referral", "flyer", "other"] as const;

export async function sendEnquiry(_prev: FormState, formData: FormData): Promise<FormState> {
  const firstName = text(formData, "first_name");
  const lastName = text(formData, "last_name");
  const values = {
    full_name: `${firstName} ${lastName}`.trim(),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    topic: text(formData, "topic"),
    message: text(formData, "message"),
  };
  const source = text(formData, "source");

  // Many parents reach the centre by WhatsApp or a flyer and may not have
  // an email address, so a phone number is an acceptable alternative.
  // The form re-fills first/last name from these on an error.
  const echo = { ...values, first_name: firstName, last_name: lastName };
  if (!firstName || !lastName || !values.message || (!isEmail(values.email) && !values.phone)) {
    return {
      error: "Add your first and last name, a message, and either an email address or a phone number.",
      values: echo,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_enquiries").insert({
    ...values,
    source: (SOURCES as readonly string[]).includes(source) ? source : "website",
  });
  if (error) return { error: "We couldn’t send your message. Please try again.", values: echo };
  return { ok: true };
}
