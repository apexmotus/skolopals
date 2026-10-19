"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/auth";
import type { UserRole } from "@/lib/database.types";

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
  if (error || !data.user) return { error: "That email and password don’t match an account.", email };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  redirect(safeNext(formData.get("next")) ?? homeFor((profile?.role ?? "student") as UserRole));
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = formData.get("role") === "tutor" ? "tutor" : "student";

  if (!fullName) return { error: "Tell us your name.", email };
  if (!email) return { error: "Enter your email address.", email };
  if (password.length < 8) return { error: "Use at least 8 characters for your password.", email };
  if (password !== confirm) return { error: "Passwords don’t match.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  });
  if (error) return { error: error.message, email };

  // Email confirmation is on: no session until the link is clicked.
  if (!data.session) {
    return { message: `Check ${email} for a link to confirm your account, then log in.`, email };
  }
  redirect(role === "tutor" ? "/become-a-tutor" : "/student");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
