"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type ReportState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveReport(_prev: ReportState, formData: FormData): Promise<ReportState> {
  await requireRole("tutor");

  const learnerId = text(formData, "learner_id");
  const termId = text(formData, "term_id");
  const summary = text(formData, "summary");
  const attendance = text(formData, "attendance_note");
  const publish = formData.get("publish") === "yes";

  if (!learnerId || !termId) return { error: "Choose a learner and a term." };

  const subjects = formData
    .getAll("subject_code")
    .map(String)
    .map((code) => ({
      subject_code: code,
      achievement_level_code: text(formData, `level_${code}`),
      strengths: text(formData, `strengths_${code}`),
      areas_for_improvement: text(formData, `improve_${code}`),
      recommended_intervention: text(formData, `intervention_${code}`),
    }))
    .filter((s) => s.achievement_level_code || s.strengths || s.areas_for_improvement);

  if (subjects.length === 0) {
    return { error: "Fill in at least one subject before saving." };
  }
  if (publish && subjects.some((s) => !s.achievement_level_code)) {
    return { error: "Give an achievement level for every subject before publishing." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_progress_report", {
    p_learner_id: learnerId,
    p_term_id: termId,
    p_summary: summary,
    p_subjects: subjects,
    p_publish: publish,
    p_attendance_note: attendance,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  revalidatePath("/tutor/reports");
  return {
    ok: publish
      ? "Published. The parent can see this report now."
      : "Saved as a draft. The parent cannot see it yet.",
  };
}
