import "server-only";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth";

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
export async function getTutorContext() {
  const session = await requireRole("tutor");
  let tutor: MyTutorProfile;
  try {
    tutor = await api.get<MyTutorProfile>("/tutors/me");
  } catch (error) {
    // A tutor role without a tutor record means an incomplete admin setup.
    if (error instanceof ApiError && error.status === 404) redirect("/");
    throw error;
  }
  return { profile: session.profile, tutor };
}

export type MyClassGroup = {
  id: string;
  name: string;
  subjectCode: string;
  languageCode: string;
  roomId?: string;
  capacity: number;
  isActive: boolean;
  gradeCodes: string[];
};

/** Classes this tutor teaches in the current term. */
export async function getMyClasses(tutorId: string) {
  return api.get<MyClassGroup[]>(`/class-groups?tutorId=${tutorId}`);
}

export type MyClassSession = {
  id: string;
  classGroupId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string;
};

/** Sessions in a date window, for the schedule and the register. Self-scoped by the API
 * to sessions this signed-in tutor teaches — there is no tutorId to pass. */
export async function getMySessions(fromISO: string, toISO: string) {
  const params = new URLSearchParams({ fromDate: fromISO, toDate: toISO, pageSize: "100" });
  const { items } = await api.getPaged<MyClassSession>(`/class-sessions?${params}`);
  return items;
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

export type TutorSessionLoad = { month: string; sessions: number; hours: number };

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
