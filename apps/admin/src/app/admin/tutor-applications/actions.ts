"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, ApiError } from "@skolopals/shared/api";
import { requireAdmin } from "@skolopals/shared/auth";

export type TutorApplicationState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

const LIST = "/admin/tutor-applications";
const detail = (id: string) => `${LIST}/${id}`;

/** The dialog's fields, shared by Open and Edit. The date input is a local date; it closes at the end of that day. */
function settings(formData: FormData) {
  const closesOn = text(formData, "closes_on");
  return {
    closesAt: closesOn ? new Date(`${closesOn}T23:59:59+02:00`).toISOString() : null,
    message: text(formData, "message"),
    needs: formData.getAll("needs").map(String).filter(Boolean),
    policeClearanceRequired: formData.get("police_clearance_required") === "on",
  };
}

async function call(fn: () => Promise<unknown>): Promise<TutorApplicationState | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function openRecruitment(_prev: TutorApplicationState, formData: FormData): Promise<TutorApplicationState> {
  await requireAdmin();
  const failed = await call(() => api.post("/tutor-applications/recruitment", settings(formData)));
  if (failed) return failed;
  revalidatePath(LIST);
  return { ok: "Applications are open. The Apply to teach button appears on the website within a minute." };
}

export async function updateRecruitment(_prev: TutorApplicationState, formData: FormData): Promise<TutorApplicationState> {
  await requireAdmin();
  const failed = await call(() => api.patch("/tutor-applications/recruitment", settings(formData)));
  if (failed) return failed;
  revalidatePath(LIST);
  return { ok: "Saved. Changes apply to applications submitted from now on." };
}

export async function closeRecruitment(_prev: TutorApplicationState, _formData: FormData): Promise<TutorApplicationState> {
  await requireAdmin();
  const failed = await call(() => api.post("/tutor-applications/recruitment/close"));
  if (failed) return failed;
  revalidatePath(LIST);
  return { ok: "Applications are closed. The button leaves the website within a minute." };
}

export async function setApplicationStatus(_prev: TutorApplicationState, formData: FormData): Promise<TutorApplicationState> {
  await requireAdmin();
  const id = text(formData, "application_id");
  const status = text(formData, "status");
  if (status !== "shortlisted" && status !== "rejected") return { error: "Unknown status." };
  const failed = await call(() => api.patch(`/tutor-applications/${id}/status`, { status, note: text(formData, "note") }));
  if (failed) return failed;
  revalidatePath(LIST);
  revalidatePath(detail(id));
  return { ok: status === "shortlisted" ? "Shortlisted. The applicant has been told." : "Rejected. The applicant has been told." };
}

export async function markIdentityChecked(_prev: TutorApplicationState, formData: FormData): Promise<TutorApplicationState> {
  await requireAdmin();
  const id = text(formData, "application_id");
  const failed = await call(() => api.post(`/tutor-applications/${id}/identity-checked`));
  if (failed) return failed;
  revalidatePath(detail(id));
  return { ok: "Identity checked." };
}

export async function requestPoliceClearance(_prev: TutorApplicationState, formData: FormData): Promise<TutorApplicationState> {
  await requireAdmin();
  const applicationId = text(formData, "application_id");
  const tutorId = text(formData, "tutor_id");
  const note = text(formData, "note");
  const failed = await call(() =>
    applicationId
      ? api.post(`/tutor-applications/${applicationId}/request-police-clearance`, { note })
      : api.post(`/tutors/${tutorId}/request-police-clearance`, { note }),
  );
  if (failed) return failed;
  revalidatePath(applicationId ? detail(applicationId) : `/admin/tutors/${tutorId}`);
  return { ok: "Requested. They have been sent a notification with an upload link." };
}

/** On success, goes to the new tutor so the admin can finish vetting and set pay. */
export async function approveApplication(_prev: TutorApplicationState, formData: FormData): Promise<TutorApplicationState> {
  await requireAdmin();
  const id = text(formData, "application_id");
  let result: { tutorId: string; skippedCompetencies: { subjectCode: string; gradeCode: string }[] };
  try {
    result = await api.post(`/tutor-applications/${id}/approve`);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(LIST);
  revalidatePath("/admin/tutors");
  const skipped = result.skippedCompetencies.length;
  redirect(`/admin/tutors/${result.tutorId}?from=application${skipped ? `&skipped=${skipped}` : ""}`);
}

/** POPIA retention: deletes an unsuccessful application that is past 12 months, with its files. Logged. */
export async function purgeApplication(_prev: TutorApplicationState, formData: FormData): Promise<TutorApplicationState> {
  await requireAdmin();
  const id = text(formData, "application_id");
  let deletedFiles = 0;
  try {
    ({ deletedFiles } = await api.post<{ deletedFiles: number }>(`/tutor-applications/${id}/purge`));
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(LIST);
  return { ok: `Deleted, with ${deletedFiles} file${deletedFiles === 1 ? "" : "s"}. The deletion is logged.` };
}
