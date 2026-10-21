import "server-only";
import { createClient } from "@/lib/supabase/server";

/** CAPS phases, in curriculum order. Loaded from the database, never hard-coded. */
export async function getPhases() {
  const supabase = await createClient();
  const { data } = await supabase.from("school_phases").select("*").order("sort_order");
  return data ?? [];
}

export async function getGrades() {
  const supabase = await createClient();
  const { data } = await supabase.from("grades").select("*").order("sort_order");
  return data ?? [];
}

export async function getSubjects() {
  const supabase = await createClient();
  const { data } = await supabase.from("subjects").select("*").order("sort_order");
  return data ?? [];
}

export async function getLanguages() {
  const supabase = await createClient();
  const { data } = await supabase.from("languages").select("*").order("sort_order");
  return data ?? [];
}

/** Subjects grouped by the phase they are offered in. Drives /subjects. */
export async function getSubjectsByPhase() {
  const supabase = await createClient();
  const [{ data: phases }, { data: offerings }] = await Promise.all([
    supabase.from("school_phases").select("*").order("sort_order"),
    supabase
      .from("subject_offerings")
      .select("subject_code, grades!inner(phase_code), subjects!inner(name, sort_order)")
      .order("subject_code"),
  ]);

  return (phases ?? []).map((phase) => {
    const names = new Map<string, number>();
    for (const o of offerings ?? []) {
      if (o.grades?.phase_code === phase.code && o.subjects) names.set(o.subjects.name, o.subjects.sort_order);
    }
    return {
      ...phase,
      subjects: [...names.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name),
    };
  });
}

/** The price list. Packages with the price in effect today. */
export async function getPackages() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: packages }, { data: prices }] = await Promise.all([
    supabase.from("packages").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("package_prices").select("*").lte("effective_from", today),
  ]);

  const current = new Map<string, number>();
  for (const p of prices ?? []) {
    if (p.effective_to && p.effective_to <= today) continue;
    current.set(p.package_code, p.amount_cents);
  }

  return (packages ?? []).map((p) => ({ ...p, amount_cents: current.get(p.code) ?? null }));
}

export type TutorFilters = { q?: string; subject?: string; grade?: string; language?: string };

/**
 * The staff directory. Not a marketplace search: no price filter and no
 * sort-by-price, because price comes from the package, not the tutor.
 */
export async function searchTutors(filters: TutorFilters = {}) {
  const supabase = await createClient();

  let matching: string[] | null = null;
  if (filters.subject || filters.grade) {
    let q = supabase.from("tutor_competencies").select("tutor_id");
    if (filters.subject) q = q.eq("subject_code", filters.subject);
    if (filters.grade) q = q.eq("grade_code", filters.grade);
    const { data } = await q;
    matching = [...new Set((data ?? []).map((r) => r.tutor_id))];
  }

  if (filters.language) {
    const { data } = await supabase
      .from("tutor_spoken_languages")
      .select("tutor_id")
      .eq("language_code", filters.language);
    const speakers = new Set((data ?? []).map((r) => r.tutor_id));
    matching = matching ? matching.filter((id) => speakers.has(id)) : [...speakers];
  }

  if (matching?.length === 0) return [];

  let query = supabase
    .from("tutors")
    .select("*, profiles!inner(full_name)")
    .eq("status", "active");
  if (matching) query = query.in("id", matching);
  if (filters.q) query = query.ilike("headline", `%${clean(filters.q)}%`);

  const { data: tutors, error } = await query;
  if (error) throw error;

  const { data: ratings } = await supabase.from("tutor_rating_summary").select("*");
  const byTutor = new Map((ratings ?? []).map((r) => [r.tutor_id, r]));

  return (tutors ?? []).map((t) => ({
    ...t,
    full_name: t.profiles?.full_name ?? "",
    rating: Number(byTutor.get(t.id)?.rating ?? 0),
    review_count: Number(byTutor.get(t.id)?.review_count ?? 0),
  }));
}

export type DirectoryTutor = Awaited<ReturnType<typeof searchTutors>>[number];

/** PostgREST filter values: strip characters that would change the syntax. */
function clean(term: string) {
  return term.replace(/[,(){}%*\\"]/g, " ").trim();
}

export async function getTutorBySlug(slug: string) {
  const supabase = await createClient();
  const { data: tutor } = await supabase
    .from("tutors")
    .select("*, profiles!inner(full_name)")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!tutor) return null;

  const [{ data: competencies }, { data: languages }, { data: quals }, { data: rating }] = await Promise.all([
    supabase
      .from("tutor_competencies")
      .select("subject_code, grade_code, subjects!inner(name), grades!inner(name, sort_order), tutor_competency_media(language_code, languages(name))")
      .eq("tutor_id", tutor.id),
    supabase.from("tutor_spoken_languages").select("languages(name)").eq("tutor_id", tutor.id),
    supabase.from("tutor_qualifications").select("*").eq("tutor_id", tutor.id),
    supabase.from("tutor_rating_summary").select("*").eq("tutor_id", tutor.id).maybeSingle(),
  ]);

  return {
    ...tutor,
    full_name: tutor.profiles?.full_name ?? "",
    competencies: competencies ?? [],
    spoken_languages: (languages ?? []).flatMap((l) => (l.languages ? [l.languages.name] : [])),
    qualifications: quals ?? [],
    rating: Number(rating?.rating ?? 0),
    review_count: Number(rating?.review_count ?? 0),
  };
}

export async function getPublishedReviews(tutorId: string, limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("tutor_id", tutorId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** The published weekly timetable. Omits meeting links by construction. */
export async function getPublicTimetable() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_public_timetable")
    .select("*")
    .order("day_of_week")
    .order("starts_at_time");
  return data ?? [];
}

export async function getOperatingHours() {
  const supabase = await createClient();
  const { data } = await supabase.from("centre_operating_hours").select("*").order("day_of_week");
  return data ?? [];
}

export async function getPublishedProgrammes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("programmes")
    .select("*")
    .eq("is_published", true)
    .gte("ends_on", new Date().toISOString().slice(0, 10))
    .order("starts_on");
  return data ?? [];
}
