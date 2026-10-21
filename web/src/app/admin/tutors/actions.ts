"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type TutorState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const clean = (m: string) => m.replace(/^.*?:\s*/, "");

export async function createTutor(_prev: TutorState, formData: FormData): Promise<TutorState> {
  await requireRole("admin");
  const email = text(formData, "email");
  const slug = text(formData, "slug") || email.split("@")[0].replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const employment = text(formData, "employment_type");
  const headline = text(formData, "headline");
  if (!email) return { error: "Enter the email address of their Skolopals account." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tutor", {
    p_email: email,
    p_slug: slug,
    p_employment_type: employment || "sessional",
    p_headline: headline,
  });
  if (error) return { error: clean(error.message) };

  revalidatePath("/admin/tutors");
  return { ok: `${email} is now a tutor.` };
}

export async function addCompetency(_prev: TutorState, formData: FormData): Promise<TutorState> {
  await requireRole("admin");
  const tutorId = text(formData, "tutor_id");
  const subject = text(formData, "subject_code");
  const grade = text(formData, "grade_code");
  const languages = formData.getAll("language_code").map(String).filter(Boolean);
  if (!subject || !grade) return { error: "Choose a subject and a grade." };
  if (languages.length === 0) return { error: "Choose at least one language of instruction." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tutor_competency", {
    p_tutor_id: tutorId,
    p_subject: subject,
    p_grade: grade,
    p_languages: languages,
  });
  // The composite FK to subject_offerings rejects a subject the centre
  // does not offer at that grade.
  if (error) {
    return {
      error: /subject_offerings|foreign key/i.test(error.message)
        ? "The centre does not offer that subject at that grade."
        : clean(error.message),
    };
  }
  revalidatePath(`/admin/tutors/${tutorId}`);
  return { ok: "Competency saved." };
}

export async function removeCompetency(_prev: TutorState, formData: FormData): Promise<TutorState> {
  await requireRole("admin");
  const id = text(formData, "competency_id");
  const tutorId = text(formData, "tutor_id");
  const supabase = await createClient();
  const { error } = await supabase.from("tutor_competencies").delete().eq("id", id);
  if (error) {
    return {
      error: /foreign key|violates/i.test(error.message)
        ? "A class relies on this competency. Remove or reassign the class first."
        : clean(error.message),
    };
  }
  revalidatePath(`/admin/tutors/${tutorId}`);
  return { ok: "Competency removed." };
}

export async function setPayRate(_prev: TutorState, formData: FormData): Promise<TutorState> {
  await requireRole("admin");
  const tutorId = text(formData, "tutor_id");
  const basis = text(formData, "pay_basis");
  const rand = Number(text(formData, "amount_rand"));
  const from = text(formData, "effective_from");
  if (!Number.isFinite(rand) || rand <= 0) return { error: "Enter the amount in Rand." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tutor_pay_rate", {
    p_tutor_id: tutorId,
    p_pay_basis: basis,
    p_amount_cents: Math.round(rand * 100),
    p_effective_from: from || new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: clean(error.message) };
  revalidatePath(`/admin/tutors/${tutorId}`);
  return { ok: "Pay rate set. Any earlier rate was closed on this date." };
}

export async function setSpokenLanguages(_prev: TutorState, formData: FormData): Promise<TutorState> {
  await requireRole("admin");
  const tutorId = text(formData, "tutor_id");
  const languages = formData.getAll("language_code").map(String).filter(Boolean);

  const supabase = await createClient();
  await supabase.from("tutor_spoken_languages").delete().eq("tutor_id", tutorId);
  if (languages.length > 0) {
    const { error } = await supabase
      .from("tutor_spoken_languages")
      .insert(languages.map((language_code) => ({ tutor_id: tutorId, language_code })));
    if (error) return { error: clean(error.message) };
  }
  revalidatePath(`/admin/tutors/${tutorId}`);
  return { ok: "Saved." };
}

export async function setTutorStatus(_prev: TutorState, formData: FormData): Promise<TutorState> {
  await requireRole("admin");
  const id = text(formData, "tutor_id");
  const status = text(formData, "status");
  if (!["active", "suspended", "inactive"].includes(status)) return { error: "Unknown status." };
  const supabase = await createClient();
  const { error } = await supabase.from("tutors").update({ status }).eq("id", id);
  if (error) return { error: clean(error.message) };
  revalidatePath("/admin/tutors");
  revalidatePath(`/admin/tutors/${id}`);
  return { ok: `Tutor ${status}.` };
}
