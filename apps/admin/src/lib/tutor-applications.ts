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

export type RecruitmentRound = {
  id: string;
  openedAt: string;
  closesAt: string | null;
  closedAt: string | null;
  message: string;
  policeClearanceRequired: boolean;
  isOpen: boolean;
  needs: string[];
  applicationCount: number;
};

export type ApplicationStatus = "submitted" | "shortlisted" | "approved" | "rejected" | "withdrawn";

export type TutorApplicationSummary = {
  id: string;
  roundId: string;
  applicantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  status: ApplicationStatus;
  submittedAt: string;
  policeClearanceRequired: boolean;
  policeClearanceRequestedAt: string | null;
  policeClearanceRequestNote: string;
  hasPoliceClearance: boolean;
  identityCheckedAt: string | null;
  tutorId: string | null;
  subjectsSummary: string;
};

export type ApplicationDocument = {
  id: string;
  docType: "cv" | "qualification" | "id" | "id_back" | "selfie" | "police_clearance";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  title: string;
  institution: string;
  yearAwarded: number | null;
  uploadedAt: string;
  url?: string;
};

export type TutorApplicationDetail = TutorApplicationSummary & {
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  country: string;
  decisionNote: string;
  reviewedAt: string | null;
  competencies: { subjectCode: string; subjectName: string; gradeCode: string; gradeName: string; languages: string[] }[];
  documents: ApplicationDocument[];
  references: { position: number; fullName: string; relationship: string; phone: string; email: string }[];
};

export const APPLICATION_FILTERS = {
  needs_action: "Needs action",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} as const;
export type ApplicationFilter = keyof typeof APPLICATION_FILTERS;

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: "New",
  shortlisted: "Shortlisted",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const APPLICATION_STATUS_TONE = {
  submitted: "warning",
  shortlisted: "brand",
  approved: "success",
  rejected: "neutral",
  withdrawn: "neutral",
} as const satisfies Record<ApplicationStatus, string>;

/** Uncached: the admin acts on what they see, so it must be current. */
export function getRecruitmentStatus() {
  return api.get<RecruitmentStatus>("/tutor-applications/recruitment");
}

export function getRecruitmentRounds() {
  return api.get<RecruitmentRound[]>("/tutor-applications/recruitment/rounds");
}

export function getTutorApplications(filter: ApplicationFilter) {
  return api.get<TutorApplicationSummary[]>(`/tutor-applications?status=${filter}`);
}

export function getTutorApplication(id: string) {
  return api.get<TutorApplicationDetail>(`/tutor-applications/${encodeURIComponent(id)}`);
}

/** Unsuccessful applications past their 12-month retention (SPEC D8). */
export type RetentionDue = { applicationId: string; name: string; status: string; decidedAt: string; dueOn: string };

export function getRetentionDue() {
  return api.get<RetentionDue[]>("/tutor-applications/retention/due");
}
