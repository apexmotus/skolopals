import "server-only";
import { api, ApiError } from "@/lib/api/client";

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

export type TutorSummary = {
  id: string;
  slug: string;
  fullName: string;
  headline: string;
  rating?: number;
  reviewCount?: number;
};

/**
 * The staff directory. Not a marketplace search: no price filter and no
 * sort-by-price, because price comes from the package, not the tutor.
 */
export async function searchTutors(filters: TutorFilters = {}) {
  const params = new URLSearchParams({ pageSize: "100" });
  if (filters.q) params.set("search", filters.q);
  if (filters.subject) params.set("subject", filters.subject);
  if (filters.grade) params.set("grade", filters.grade);
  if (filters.language) params.set("language", filters.language);

  const { items } = await api.getPaged<TutorSummary>(`/tutors?${params}`);
  return items;
}

export type DirectoryTutor = Awaited<ReturnType<typeof searchTutors>>[number];

export type TutorCompetency = { subjectCode: string; gradeCode: string; mediaLanguageCodes: string[] };
export type TutorQualification = {
  id: string;
  title: string;
  institution: string;
  yearAwarded?: number;
};

export async function getTutorBySlug(slug: string) {
  let tutor: TutorSummary & { bio: string };
  try {
    tutor = await api.get(`/tutors/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }

  const [competencies, qualifications, spokenLanguages] = await Promise.all([
    api.get<TutorCompetency[]>(`/tutors/${tutor.id}/competencies`),
    api.get<TutorQualification[]>(`/tutors/${tutor.id}/qualifications`),
    api.get<{ languageCode: string }[]>(`/tutors/${tutor.id}/spoken-languages`),
  ]);

  return {
    ...tutor,
    competencies,
    qualifications,
    spokenLanguageCodes: spokenLanguages.map((l) => l.languageCode),
  };
}

export type TutorReview = {
  id: string;
  rating: number;
  comment: string;
  publishedAt?: string;
};

export async function getPublishedReviews(tutorId: string, limit = 5) {
  const reviews = await api.get<TutorReview[]>(`/tutors/${tutorId}/reviews`);
  return reviews.slice(0, limit);
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
