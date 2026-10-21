import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Reference data every assessment and report screen needs. */
export async function getAssessmentReference() {
  const supabase = await createClient();
  const [types, domains, levels, terms] = await Promise.all([
    supabase.from("assessment_types").select("code, name").order("sort_order"),
    supabase.from("assessment_domains").select("code, name").order("sort_order"),
    supabase.from("achievement_levels").select("code, label").order("code", { ascending: false }),
    supabase.from("terms").select("id, year, term_number").order("year", { ascending: false }).order("term_number"),
  ]);
  return {
    types: types.data ?? [],
    domains: domains.data ?? [],
    levels: levels.data ?? [],
    terms: (terms.data ?? []).map((t) => ({ id: t.id, label: `Term ${t.term_number} ${t.year}` })),
  };
}

/** Assessments for the learners this tutor teaches. RLS does the scoping. */
export async function getAssessments(limit = 25) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select(
      "*, learners(full_name), assessment_types(name), subjects(name), assessment_scores(domain_code, raw_score, max_score, percent, achievement_levels(label))",
    )
    .order("assessed_on", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getLearningPlans() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("learning_plans")
    .select("*, learners(full_name), learning_plan_goals(*, subjects(name), achievement_levels(label))")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getReports() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_reports")
    .select(
      "*, learners(full_name), terms(year, term_number), progress_report_subjects(*, subjects(name), achievement_levels(label)), report_acknowledgements(acknowledged_at, comment)",
    )
    .order("created_at", { ascending: false });
  return data ?? [];
}
