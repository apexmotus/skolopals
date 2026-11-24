"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@skolopals/shared/supabase/server";
import { requireRole } from "@skolopals/shared/auth";
import { api, ApiError } from "@skolopals/shared/api";

export type ApproveState = { error?: string; ok?: string };

/** The 422 messages come from the database functions and are written to be shown. */
function message(err: unknown, fallback: string) {
  return err instanceof ApiError && err.status < 500 ? err.message : fallback;
}

/**
 * Accept (SPEC §4.4). The API raises the pre-paid offer invoice (registration
 * + tuition for the rest of the month) and tells the parent. Refused without
 * a finished aptitude test and a report card (D15). Also re-accepts a lapsed offer.
 */
export async function acceptApplication(_prev: ApproveState, formData: FormData): Promise<ApproveState> {
  await requireRole("admin");
  const id = String(formData.get("enrolment_id") ?? "");
  try {
    await api.post(`/enrolments/${id}/accept`);
  } catch (err) {
    return { error: message(err, "Could not accept the application.") };
  }
  revalidatePath("/admin/enrolments");
  redirect("/admin/enrolments?done=accepted");
}

/** Decline: a reason is required and is sent to the parent with any message. No invoice exists to undo. */
export async function declineApplication(_prev: ApproveState, formData: FormData): Promise<ApproveState> {
  await requireRole("admin");
  const id = String(formData.get("enrolment_id") ?? "");
  const choice = String(formData.get("reason") ?? "");
  const other = String(formData.get("reason_other") ?? "").trim();
  const reason = choice === "other" ? other : choice;
  const note = String(formData.get("message") ?? "").trim();
  if (!reason) return { error: "Choose a reason, or describe it under Other." };

  try {
    await api.post(`/enrolments/${id}/decline`, { reason, message: note || undefined });
  } catch (err) {
    return { error: message(err, "Could not decline the application.") };
  }
  revalidatePath("/admin/enrolments");
  redirect("/admin/enrolments?done=declined");
}

/**
 * "Request more information" without changing the stage, e.g. for a clearer
 * report card (which the parent can replace from their portal). Uses the
 * existing messaging: a thread with the learner's guardians.
 */
export async function requestInformation(_prev: ApproveState, formData: FormData): Promise<ApproveState> {
  await requireRole("admin");
  const learnerId = String(formData.get("learner_id") ?? "");
  const guardians = formData.getAll("guardian_id").map(String).filter(Boolean);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write what you need from the family." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_thread", {
    p_subject: "About your application",
    p_body: body,
    p_participants: guardians,
    p_learner_id: learnerId,
  });
  if (error) return { error: "Could not send the message." };
  return { ok: "Message sent. The family sees it under Messages in their portal." };
}

/** Admin retry (SPEC §5.2): only an accepted application whose offer invoice is paid. */
export async function activateApplication(_prev: ApproveState, formData: FormData): Promise<ApproveState> {
  await requireRole("admin");
  const id = String(formData.get("enrolment_id") ?? "");
  try {
    await api.post(`/enrolments/${id}/activate`, {});
  } catch (err) {
    return { error: message(err, "Could not activate the enrolment.") };
  }
  revalidatePath(`/admin/enrolments/${id}`);
  return { ok: "Activated. Place the learner from the Timetable page." };
}

/** Sets the aptitude attempt aside so the learner can sit the test again. */
export async function allowRetake(_prev: ApproveState, formData: FormData): Promise<ApproveState> {
  await requireRole("admin");
  const enrolmentId = String(formData.get("enrolment_id") ?? "");
  const attemptId = String(formData.get("attempt_id") ?? "");
  try {
    await api.post(`/aptitude/attempts/${attemptId}/retake`);
  } catch (err) {
    return { error: message(err, "Could not allow a retake.") };
  }
  revalidatePath(`/admin/enrolments/${enrolmentId}`);
  revalidatePath("/admin/enrolments");
  return { ok: "The test was set aside. The parent can start it again from their portal." };
}
