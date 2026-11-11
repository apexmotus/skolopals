"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/auth";
import type { AppRole } from "@/lib/database.types";

export type AuthState = { error?: string; message?: string; email?: string };

function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  // Only allow same-site relative paths.
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

/** The origin this request arrived on, so confirmation links come back to the same deployment (dev, UAT, prod, or localhost). */
async function requestOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email address and password.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "That email and password don’t match an account.", email };

  const me = await api.get<{ roles: string[] }>("/people/me");
  redirect(safeNext(formData.get("next")) ?? homeFor(me.roles as AppRole[]));
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName) return { error: "Tell us your name.", email };
  if (!email) return { error: "Enter your email address.", email };
  if (password.length < 8) return { error: "Use at least 8 characters for your password.", email };
  if (password !== confirm) return { error: "Passwords don’t match.", email };

  const supabase = await createClient();
  // No role is selectable at sign-up. Everyone who registers is a parent or
  // guardian; tutors and administrators are created by the centre.
  // just to trigga 
  // Supabase's default confirmation email (templates can't be edited without
  // custom SMTP) links to its verify endpoint, which then redirects to
  // `emailRedirectTo` — provided it is allow-listed under Authentication → URL
  // Configuration — carrying a PKCE `code` that app/auth/confirm/route.ts
  // exchanges for a session. Without it the link lands on the Site URL root
  // and the session is lost.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone },
      emailRedirectTo: `${await requestOrigin()}/auth/confirm`,
    },
  });
  if (error) return { error: error.message, email };

  // Email confirmation is on: no session until the link is clicked.
  if (!data.session) {
    return { message: `Check ${email} for a link to confirm your account, then log in.`, email };
  }
  redirect("/parent");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
