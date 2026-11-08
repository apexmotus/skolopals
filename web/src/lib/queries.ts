import "server-only";
import { api, ApiError } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/server";

type Phase = { code: string; name: string; sortOrder: number };
type Grade = { code: string; name: string; phaseCode: string; sortOrder: number };
type Subject = { code: string; name: string; description: string; isLanguage: boolean; sortOrder: number };
type Language = { code: string; name: string; sortOrder: number };
type SubjectOffering = { subjectCode: string; gradeCode: string };
type Package = {
  code: string;
  name: string;
  description: string;
  serviceType: string;
  billingPeriod: string;
  subjectAllowance?: number;
  isActive: boolean;
  sortOrder: number;
};

/** CAPS phases, in curriculum order. Loaded from the API's `reference` module, never hard-coded. */
export async function getPhases() {
  return api.get<Phase[]>("/reference/phases");
}

export async function getGrades() {
  return api.get<Grade[]>("/reference/grades");
}

export async function getSubjects() {
  return api.get<Subject[]>("/reference/subjects");
}

export async function getLanguages() {
  return api.get<Language[]>("/reference/languages");
}

/** Subjects grouped by the phase they are offered in. Drives /subjects. */
export async function getSubjectsByPhase() {
  const [phases, grades, subjects, offerings] = await Promise.all([
    api.get<Phase[]>("/reference/phases"),
    api.get<Grade[]>("/reference/grades"),
    api.get<Subject[]>("/reference/subjects"),
    api.get<SubjectOffering[]>("/reference/subject-offerings"),
  ]);

  const phaseOfGrade = new Map(grades.map((g) => [g.code, g.phaseCode]));
  const subjectByCode = new Map(subjects.map((s) => [s.code, s]));

  return phases.map((phase) => {
    const names = new Map<string, number>();
    for (const o of offerings) {
      if (phaseOfGrade.get(o.gradeCode) !== phase.code) continue;
      const subject = subjectByCode.get(o.subjectCode);
      if (subject) names.set(subject.name, subject.sortOrder);
    }
    return {
      code: phase.code,
      name: phase.name,
      subjects: [...names.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name),
    };
  });
}

/** The price list. Packages with the price in effect today. */
export async function getPackages() {
  const packages = await api.get<Package[]>("/packages");

  const amounts = await Promise.all(
    packages.map(async (p) => {
      try {
        const { amountCents } = await api.get<{ amountCents: number }>(`/packages/${p.code}/price`);
        return amountCents;
      } catch (error) {
        // No price has ever been set for this package — same as the old query finding no row.
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    }),
  );

  return packages.map((p, i) => ({ ...p, amountCents: amounts[i] }));
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

export type PublicTimetableEntry = {
  classGroupId: string;
  className: string;
  subject: string;
  language: string;
  deliveryMode: string;
  capacity: number;
  dayOfWeek: number;
  startsAtTime: string;
  endsAtTime: string;
  tutorSlug: string;
  tutorName: string;
};

/** The published weekly timetable. Omits meeting links by construction. */
export async function getPublicTimetable() {
  return api.get<PublicTimetableEntry[]>("/timetable/public");
}

export type OperatingHour = { dayOfWeek: number; opensAt: string; closesAt: string; purpose: string };

export async function getOperatingHours() {
  return api.get<OperatingHour[]>("/reference/operating-hours");
}

export type Programme = {
  id: string;
  name: string;
  description: string;
  programmeType: string;
  startsOn: string;
  endsOn: string;
  capacity: number;
  priceCents: number;
  deliveryMode: string;
  roomId?: string;
  isPublished: boolean;
};

export async function getPublishedProgrammes() {
  // GET /programmes returns every programme to an admin actor (not just published ones) and
  // never applies the "still running or upcoming" cutoff - both are applied here, same as before.
  const today = new Date().toISOString().slice(0, 10);
  const programmes = await api.get<Programme[]>("/programmes");
  return programmes.filter((p) => p.isPublished && p.endsOn >= today);
}
