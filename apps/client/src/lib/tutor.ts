import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { api, ApiError } from "@skolopals/shared/api";
import { requireRole } from "@skolopals/shared/auth";

type MyTutorProfile = {
  id: string;
  fullName: string;
  slug: string;
  headline: string;
  bio: string;
  employmentType: string;
  status: string;
};

/** The signed-in tutor's staff record. Admin-created, so it always exists. */
export const getTutorContext = cache(async () => {
  // Both lookups start together rather than one after the other. The tutor record is settled
  // up front so its failure can't escape unhandled while the role check runs, and is only
  // inspected after that check passes — a non-tutor is still redirected, never shown an error.
  const tutorLookup = api.get<MyTutorProfile>("/tutors/me").then(
    (tutor) => ({ tutor }),
    (error: unknown) => ({ error }),
  );
  const session = await requireRole("tutor");
  const result = await tutorLookup;
  if ("error" in result) {
    // A tutor role without a tutor record means an incomplete admin setup.
    if (result.error instanceof ApiError && result.error.status === 404) redirect("/");
    throw result.error;
  }
  return { profile: session.profile, tutor: result.tutor };
});

export type MyClassGroup = {
  id: string;
  name: string;
  subjectCode: string;
  languageCode: string;
  deliveryMode: string;
  roomId?: string;
  capacity: number;
  isActive: boolean;
  gradeCodes: string[];
};

/** Classes this tutor teaches in the current term. Cached per request, since a page and
 * getMySessions both need them. */
export const getMyClasses = cache(async (tutorId: string) => {
  return api.get<MyClassGroup[]>(`/class-groups?tutorId=${tutorId}`);
});

export type MyClassSession = {
  id: string;
  classGroupId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: string;
  /** A substitute for this occurrence only. Absent means the class's own tutor teaches it. */
  tutorId?: string;
  meetingUrl?: string;
  notes: string;
};

/** Sessions this tutor teaches in a date window, with the class each one belongs to.
 * The API returns every session the tutor may read, which includes other tutors' sessions
 * for learners they share, so it is narrowed here to the teaching tutor: the session's
 * substitute if one is set, otherwise the class's own tutor. */
export async function getMySessions(tutorId: string, fromISO: string, toISO: string) {
  const params = new URLSearchParams({ fromDate: fromISO, toDate: toISO, pageSize: "100" });
  const [{ items }, classes] = await Promise.all([
    api.getPaged<MyClassSession>(`/class-sessions?${params}`),
    getMyClasses(tutorId),
  ]);
  const own = new Set(classes.map((c) => c.id));
  const sessions = items.filter((s) => (s.tutorId ? s.tutorId === tutorId : own.has(s.classGroupId)));

  // A session covered as a substitute belongs to another tutor's class, so look that class up too.
  const covered = [...new Set(sessions.map((s) => s.classGroupId).filter((id) => !own.has(id)))];
  const coveredClasses = await Promise.all(covered.map((id) => api.get<MyClassGroup>(`/class-groups/${id}`)));
  const classById = new Map([...classes, ...coveredClasses].map((c) => [c.id, c]));

  return { sessions, classById };
}

export type MyLearner = { id: string; fullName: string; gradeCode: string };

/** Learners this tutor teaches. Self-scoped by the API's own RLS, same as sessions. */
export async function getMyLearners() {
  const { items } = await api.getPaged<MyLearner>("/learners?pageSize=100");
  return items;
}

/** Which of this tutor's classes each learner is placed in, for the one page that shows it. */
export async function getLearnerClassNames(tutorId: string) {
  const classes = await getMyClasses(tutorId);
  const byLearner = new Map<string, string[]>();
  await Promise.all(
    classes.map(async (c) => {
      const placements = await api.get<{ learnerId: string }[]>(`/class-groups/${c.id}/enrolments`);
      for (const p of placements) {
        const names = byLearner.get(p.learnerId) ?? [];
        names.push(c.name);
        byLearner.set(p.learnerId, names);
      }
    }),
  );
  return byLearner;
}

export type TutorReview = {
  id: string;
  rating: number;
  comment: string;
  publishedAt?: string;
  createdAt: string;
};

/** Published reviews only — pending and rejected ones stay with the administrator. */
export async function getMyReviews(tutorId: string) {
  return api.get<TutorReview[]>(`/tutors/${tutorId}/reviews`);
}

export type TutorSessionLoad ={ month: string; sessions: number; hours: number };

/** Sessions taught and hours, by month. Tutors are paid as staff, not a share.
 * Self-scoped by the API — there is no tutorId to pass. */
export async function getSessionLoad() {
  return api.get<TutorSessionLoad[]>("/tutors/me/session-load");
}

type TutorPayRate = {
  payBasis: string;
  amountCents: number;
  effectiveFrom: string;
  effectiveTo?: string;
};

export async function getMyPayRate(tutorId: string) {
  const rates = await api.get<TutorPayRate[]>(`/tutors/${tutorId}/pay-rates`);
  const latest = rates[0];
  if (!latest) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (latest.effectiveTo && latest.effectiveTo <= today) return null;
  return latest;
}
