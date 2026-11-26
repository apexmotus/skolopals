"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@skolopals/shared/api";
import { getSession } from "@skolopals/shared/auth";
import type { UploadedFile } from "@/components/uploads/upload-field";

export type TeachState = { error?: string; ok?: string };

/** What the wizard sends. Mirrors `SubmitTutorApplicationDto`. */
export type TutorApplicationPayload = {
  firstName: string;
  lastName: string;
  phone: string;
  whatsappNumber?: string;
  address: { line1: string; line2?: string; city: string; province: string; country: string };
  competencies: { subjectCode: string; gradeCodes: string[]; languageCodes: string[] }[];
  documents: (UploadedFile & {
    docType: "cv" | "qualification" | "id" | "id_back" | "selfie" | "police_clearance";
    title?: string;
    institution?: string;
    yearAwarded?: number;
  })[];
  references: { fullName: string; relationship: string; phone: string; email?: string }[];
  consents: { popia: boolean; referencesAgreed: boolean; declaration: boolean };
};

function failure(error: unknown): TeachState {
  if (error instanceof ApiError && error.status < 500) return { error: error.message };
  return { error: "We could not send your application. Check your connection and try again." };
}

export async function submitTutorApplication(payload: TutorApplicationPayload): Promise<TeachState> {
  if (!(await getSession())) return { error: "Your session has ended. Sign in again to send your application." };
  try {
    await api.post("/tutor-applications", {
      ...payload,
      documents: payload.documents.map((d) => ({
        docType: d.docType,
        path: d.path,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        originalName: d.originalName,
        title: d.title,
        institution: d.institution,
        yearAwarded: d.yearAwarded,
      })),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/teach");
  return { ok: "sent" };
}

export async function withdrawTutorApplication(applicationId: string): Promise<TeachState> {
  try {
    await api.post(`/tutor-applications/me/${encodeURIComponent(applicationId)}/withdraw`);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/teach");
  return { ok: "Your application has been withdrawn." };
}

/** From an applicant under review or a tutor after approval; the API files it in the right place. */
export async function uploadPoliceClearance(file: UploadedFile): Promise<TeachState> {
  try {
    await api.post("/tutor-applications/me/police-clearance", {
      path: file.path,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      originalName: file.originalName,
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/teach");
  revalidatePath("/tutor");
  return { ok: "Thank you. The centre has been told your certificate is in." };
}
