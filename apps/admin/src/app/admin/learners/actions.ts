"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@skolopals/shared/auth";
import * as edit from "@skolopals/shared/learner-edit";
import type { LearnerEditState } from "@skolopals/shared/learner-edit";

async function run(
  formData: FormData,
  write: (fd: FormData) => Promise<LearnerEditState>,
): Promise<LearnerEditState> {
  await requireRole("admin");
  const result = await write(formData);
  if (result.ok) {
    revalidatePath("/admin/learners");
    revalidatePath(`/admin/learners/${String(formData.get("learner_id") ?? "")}`);
  }
  return result;
}

export async function updateLearner(_prev: LearnerEditState, formData: FormData) {
  return run(formData, (fd) => edit.updateLearnerDetails(fd, { allowStatus: true }));
}

export async function addEmergencyContact(_prev: LearnerEditState, formData: FormData) {
  return run(formData, edit.addEmergencyContact);
}

export async function removeEmergencyContact(_prev: LearnerEditState, formData: FormData) {
  return run(formData, edit.removeEmergencyContact);
}

export async function addCollector(_prev: LearnerEditState, formData: FormData) {
  return run(formData, edit.addCollector);
}

export async function removeCollector(_prev: LearnerEditState, formData: FormData) {
  return run(formData, edit.removeCollector);
}
