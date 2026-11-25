"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@skolopals/shared/api";
import { requireAdmin } from "@skolopals/shared/auth";

export type EnquiryState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Logs an enquiry that came in by phone, WhatsApp or at the door, so it is tracked like a website one. */
export async function logEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  await requireAdmin();
  const fullName = text(formData, "full_name");
  const phone = text(formData, "phone");
  const email = text(formData, "email");
  const message = text(formData, "message");

  if (!fullName) return { error: "Enter the person’s name." };
  if (!phone && !email) return { error: "Add a phone number or an email address so you can get back to them." };
  if (!message) return { error: "Note what they asked about." };

  try {
    await api.post("/enquiries", {
      fullName,
      phone: phone || undefined,
      email: email || undefined,
      topic: text(formData, "topic") || undefined,
      message,
      source: text(formData, "source") || "other",
    });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/enquiries");
  revalidatePath("/admin");
  return { ok: "Enquiry logged." };
}

/** New, contacted or closed. "Enrolled" only comes from linking the learner, below. */
export async function setEnquiryStatus(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  await requireAdmin();
  const id = text(formData, "enquiry_id");
  const status = text(formData, "status");
  if (!["new", "contacted", "closed"].includes(status)) return { error: "Choose a status." };

  try {
    await api.patch(`/enquiries/${id}`, { status });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/enquiries");
  revalidatePath("/admin");
  return { ok: "Status updated." };
}

/** Marks the enquiry as enrolled and links it to the learner it became, for the KPI conversion figures. */
export async function convertEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  await requireAdmin();
  const id = text(formData, "enquiry_id");
  const learnerId = text(formData, "learner_id");
  if (!learnerId) return { error: "Choose the learner this enquiry became." };

  try {
    await api.post(`/enquiries/${id}/convert`, { learnerId });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/enquiries");
  revalidatePath("/admin/reports");
  return { ok: "Marked as enrolled." };
}
