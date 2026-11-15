"use server";

import { redirect } from "next/navigation";
import { api } from "@skolopals/shared/api";
import { isAdminRole } from "@skolopals/shared/auth";
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
  if (!isAdminRole(me.roles)) {
    await supabase.auth.signOut();
    return { error: "Access denied. This portal is restricted to administrators.", email };
  }

  redirect(safeNext(formData.get("next")) ?? "/admin");
}

export async function completeRegistration(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password." };
  }
  if (password !== confirm) {
    return { error: "Passwords don’t match." };
  }

  const supabase = await createClient();
  // Supabase's default invite email delivers the session as tokens in the URL fragment; the form
  // forwards them here. A link that went through /auth/confirm already has a session cookie.
  const accessToken = String(formData.get("access_token") ?? "");
  const refreshToken = String(formData.get("refresh_token") ?? "");
  if (accessToken && refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { error: "Your invitation link has expired or is invalid. Please ask an administrator to re-invite you." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
