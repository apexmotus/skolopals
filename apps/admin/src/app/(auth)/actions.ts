"use server";

import { redirect } from "next/navigation";
import { api } from "@skolopals/shared/api";
import { createClient } from "@skolopals/shared/supabase/server";

export type AuthState = { error?: string; message?: string; email?: string };

function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  // Only allow same-site relative paths.
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email address and password.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: "That email and password don’t match an account.", email };
  }

  const me = await api.get<{ roles: string[] }>("/people/me");
  if (!me.roles.includes("admin")) {
    await supabase.auth.signOut();
    return { error: "Access denied. This portal is restricted to administrators.", email };
  }

  redirect(safeNext(formData.get("next")) ?? "/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
