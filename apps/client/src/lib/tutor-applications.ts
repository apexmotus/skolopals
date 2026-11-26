import "server-only";
import { api } from "@skolopals/shared/api";

/** `GET /tutor-applications/recruitment`. */
export type RecruitmentStatus = {
  isOpen: boolean;
  roundId?: string;
  closesAt?: string | null;
  message?: string;
  policeClearanceRequired?: boolean;
  needs?: { code: string; name: string }[];
};

/** `GET /tutor-applications/me`: the signed-in user's latest application. */
export type MyTutorApplication = {
  id: string;
  roundId: string;
  status: "submitted" | "shortlisted" | "approved" | "rejected" | "withdrawn";
  submittedAt: string;
  policeClearanceRequired: boolean;
  policeClearanceRequestedAt: string | null;
  policeClearanceRequestNote: string;
  hasPoliceClearance: boolean;
};

/**
 * For the landing page: shared by every visitor and cached for a minute, so
 * the admin's switch shows on the site within a minute (SPEC §2.3).
 */
export async function getRecruitmentStatus(): Promise<RecruitmentStatus> {
  try {
    return await api.public.get<RecruitmentStatus>("/tutor-applications/recruitment", "live");
  } catch {
    // The landing page must render even if this one read fails; no button is the safe default.
    return { isOpen: false };
  }
}

/** For /teach: never cached, because the form must not open after the admin has closed it. */
export function getRecruitmentStatusNow() {
  return api.get<RecruitmentStatus>("/tutor-applications/recruitment");
}

export async function getMyTutorApplication() {
  return (await api.get<MyTutorApplication | null>("/tutor-applications/me")) ?? null;
}

export const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;
