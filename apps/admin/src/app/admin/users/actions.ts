"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@skolopals/shared/api";
import { assignableRolesFor, requireAdmin, type InvitableUserRole } from "@skolopals/shared/auth";

export type InviteUserState = { error?: string; ok?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function inviteUser(_prev: InviteUserState, formData: FormData): Promise<InviteUserState> {
  const session = await requireAdmin();
  const firstName = text(formData, "first_name");
  const lastName = text(formData, "last_name");
  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role") as InvitableUserRole;

  if (!firstName || !lastName) return { error: "Enter the person’s first name and last name." };
  if (!email) return { error: "Enter the person’s email address." };
  // The API enforces this too; checking here keeps a tampered form from reaching it.
  if (!assignableRolesFor(session.roles).includes(role)) return { error: "Choose a role for this user." };

  try {
    await api.post("/people/users", { firstName, lastName, email, role });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/users");
  return { ok: `Invitation sent to ${email}. They’ll get an email with a link to create their password.` };
}
