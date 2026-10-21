"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export type AssessState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const clean = (m: string) => m.replace(/^.*?:\s*/, "");

export async function recordAssessment(_prev: AssessState, formData: FormData): Promise<AssessState> {
  await requireRole("tutor");

  const learnerId = text(formData, "learner_id");
  const type = text(formData, "assessment_type_code");
  const grade = text(formData, "grade_code");
  const assessedOn = text(formData, "assessed_on");
  const subject = text(formData, "subject_code");
  const termId = text(formData, "term_id");
  const notes = text(formData, "notes");

  if (!learnerId || !type || !grade || !assessedOn) {
    return { error: "Choose a learner, a type and a date." };
  }

  // Only domains with a mark are recorded. A blank row means "not assessed",
  // which is different from a zero.
  const scores = formData
    .getAll("domain")
    .map(String)
    .map((code) => ({
      domain_code: code,
      raw_score: text(formData, `raw_${code}`),
      max_score: text(formData, `max_${code}`),
    }))
    .filter((d) => d.raw_score !== "" && d.max_score !== "")
    .map((d) => ({
      domain_code: d.domain_code,
      raw_score: Number(d.raw_score),
      max_score: Number(d.max_score),
    }));

  if (scores.length === 0) return { error: "Enter a mark for at least one domain." };
  if (scores.some((s) => !Number.isFinite(s.raw_score) || !Number.isFinite(s.max_score) || s.max_score <= 0)) {
    return { error: "Marks must be numbers, and the total must be more than zero." };
  }
  if (scores.some((s) => s.raw_score > s.max_score)) {
    return { error: "A mark cannot be higher than the total." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_assessment", {
    p_learner_id: learnerId,
    p_type: type,
    p_grade_code: grade,
    p_assessed_on: assessedOn,
    p_scores: scores,
    p_subject: subject || null,
    p_term_id: termId || null,
    p_notes: notes,
  });
  if (error) return { error: clean(error.message) };

  revalidatePath("/tutor/assessments");
  return { ok: "Assessment recorded. The achievement level was set from the mark." };
}

export async function createLearningPlan(_prev: AssessState, formData: FormData): Promise<AssessState> {
  await requireRole("tutor");
  const learnerId = text(formData, "learner_id");
  const assessmentId = text(formData, "assessment_id");
  const termId = text(formData, "term_id");

  const goals = formData
    .getAll("goal_subject")
    .map(String)
    .map((subject, i) => ({
      subject_code: subject,
      goal: text(formData, `goal_text_${i}`),
      target_level_code: text(formData, `goal_level_${i}`),
      target_date: text(formData, `goal_date_${i}`),
    }))
    .filter((g) => g.subject_code && g.goal);

  if (goals.length === 0) return { error: "Write at least one goal." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_learning_plan", {
    p_learner_id: learnerId,
    p_goals: goals,
    p_assessment_id: assessmentId || null,
    p_term_id: termId || null,
  });
  if (error) return { error: clean(error.message) };

  revalidatePath("/tutor/assessments");
  return { ok: "Learning plan created. Any previous plan was superseded." };
}
