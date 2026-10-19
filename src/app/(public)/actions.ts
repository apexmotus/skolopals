"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: boolean; values?: Record<string, string> };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export async function sendContactMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: text(formData, "name"),
    email: text(formData, "email"),
    topic: text(formData, "topic"),
    message: text(formData, "message"),
  };
  if (!values.name || !isEmail(values.email) || !values.message) {
    return { error: "Add your name, a valid email and a message.", values };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert(values);
  if (error) return { error: "We couldn’t send your message. Please try again.", values };
  return { ok: true };
}

export async function submitApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    full_name: text(formData, "full_name"),
    email: text(formData, "email"),
    subjects: text(formData, "subjects"),
    grades: text(formData, "grades"),
    qualifications: text(formData, "qualifications"),
    experience: text(formData, "experience"),
  };
  // Storage paths of files the browser already uploaded to the private bucket.
  const documents = formData
    .getAll("documents")
    .map(String)
    .filter((p) => /^applications\/[0-9a-f-]{36}\/[\w.-]+$/.test(p));
  const hasId = documents.some((d) => d.includes("/identity-"));
  const hasCerts = documents.some((d) => d.includes("/certificate-"));

  if (!values.full_name || !isEmail(values.email) || !values.subjects) {
    return { error: "Add your name, a valid email and the subjects you teach.", values };
  }
  if (!hasId || !hasCerts) {
    return { error: "Upload your identity document and at least one certificate.", values };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { error } = await supabase
    .from("tutor_applications")
    .insert({ ...values, documents, user_id: data?.claims?.sub ?? null });
  if (error) return { error: "We couldn’t submit your application. Please try again.", values };

  redirect("/become-a-tutor/submitted");
}
