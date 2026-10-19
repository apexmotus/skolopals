import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tutor } from "@/lib/database.types";

export const SUBJECTS = ["Mathematics", "English", "Science", "Physics", "Languages", "Computing", "Exam preparation"];
export const GRADES = ["Grades 5–6", "Grades 7–9", "Grades 10–12", "GCSE", "A-Level"];
export const LANGUAGES = ["English", "Spanish", "French"];
export const PRICE_RANGES = [
  { value: "0-4000", label: "Under $40/hr" },
  { value: "4000-5000", label: "$40–$50/hr" },
  { value: "5000-99999", label: "$50+/hr" },
];
export const SORTS = [
  { value: "rating", label: "Highest rated" },
  { value: "price_asc", label: "Lowest price" },
  { value: "price_desc", label: "Highest price" },
  { value: "reviews", label: "Most reviews" },
];

export type TutorFilters = {
  q?: string;
  subject?: string;
  grade?: string;
  price?: string;
  rating?: string;
  language?: string;
  sort?: string;
  page?: number;
};

export const PAGE_SIZE = 6;

export async function searchTutors(filters: TutorFilters) {
  const supabase = await createClient();
  let query = supabase.from("tutors").select("*", { count: "exact" }).eq("status", "approved");

  const subject = filters.subject || filters.q;
  if (subject) {
    const t = cleanTerm(subject);
    query = query.or(`subjects.cs.{"${t}"},headline.ilike.%${t}%,full_name.ilike.%${t}%`);
  }
  if (filters.grade) query = query.ilike("grades", `%${cleanTerm(filters.grade).replace(/Grades?\s*/i, "")}%`);
  if (filters.language) query = query.contains("languages", [filters.language]);
  if (filters.rating) query = query.gte("rating", Number(filters.rating));
  if (filters.price) {
    const [min, max] = filters.price.split("-").map(Number);
    if (Number.isFinite(min)) query = query.gte("hourly_rate_cents", min);
    if (Number.isFinite(max)) query = query.lt("hourly_rate_cents", max);
  }

  switch (filters.sort) {
    case "price_asc":
      query = query.order("hourly_rate_cents", { ascending: true });
      break;
    case "price_desc":
      query = query.order("hourly_rate_cents", { ascending: false });
      break;
    case "reviews":
      query = query.order("review_count", { ascending: false });
      break;
    default:
      query = query.order("rating", { ascending: false }).order("review_count", { ascending: false });
  }

  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { tutors: (data ?? []) as Tutor[], total: count ?? 0, page };
}

// PostgREST filter values: strip characters that would change the filter syntax.
function cleanTerm(term: string) {
  return term.replace(/[,(){}%*\\"]/g, " ").trim();
}

export async function getTutorBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("tutors").select("*").eq("slug", slug).eq("status", "approved").maybeSingle();
  return data;
}

export async function getOpenSlots(tutorId: string, limit = 25) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("tutor_id", tutorId)
    .eq("is_booked", false)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(limit);
  return data ?? [];
}

export async function getReviews(tutorId: string, limit = 3) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
