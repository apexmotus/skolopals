"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@skolopals/shared/auth";
import * as door from "@skolopals/shared/door";

export async function doorSignIn(_prev: door.DoorState, formData: FormData): Promise<door.DoorState> {
  await requireAdmin();
  const result = await door.signIn(formData);
  revalidatePath("/admin/door");
  return result;
}

export async function doorSignOut(_prev: door.DoorState, formData: FormData): Promise<door.DoorState> {
  await requireAdmin();
  const result = await door.signOut(formData);
  revalidatePath("/admin/door");
  return result;
}

export async function doorUndo(_prev: door.DoorState, formData: FormData): Promise<door.DoorState> {
  await requireAdmin();
  const result = await door.undoSignOut(formData);
  revalidatePath("/admin/door");
  return result;
}
