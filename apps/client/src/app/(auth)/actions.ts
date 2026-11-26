"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@skolopals/shared/api";
import { createClient } from "@skolopals/shared/supabase/server";
import { clientHomeFor } from "@skolopals/shared/auth";
import type { AppRole } from "@skolopals/shared/database.types";

export type AuthState = { error?: string; message?: string; email?: string };

const CLIENT_ROLES: AppRole[] = ["tutor", "parent", "learner"];

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
  const roles = me.roles as AppRole[];
  const hasClientRole = roles.some((r) => CLIENT_ROLES.includes(r));

  if (roles.includes("admin") && !hasClientRole) {
    await supabase.auth.signOut();
    return { error: "Administrator accounts must sign in via the Admin Portal.", email };
  }

  redirect(safeNext(formData.get("next")) ?? clientHomeFor(roles));
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!firstName || !lastName) return { error: "Tell us your first name and last name.", email };
  if (!email) return { error: "Enter your email address.", email };
  if (password.length < 8) return { error: "Use at least 8 characters for your password.", email };
  if (password !== confirm) return { error: "Passwords don’t match.", email };

  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  // No role is selectable at sign-up. Everyone who registers is a parent or
  // guardian; tutors and administrators are created by the centre (a tutor
  // applicant signs up the same way and is only made a tutor on approval).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, full_name: fullName, phone },
      emailRedirectTo: `${await requestOrigin()}/auth/confirm${next ? `?next=${encodeURIComponent(next)}` : ""}`,
    },
  });
  if (error) return { error: error.message, email };

  // Email confirmation is on: no session until the link is clicked.
  if (!data.session) {
    return { message: `Check ${email} for a link to confirm your account, then log in.`, email };
  }
  redirect(next ?? "/parent");
}

export async function completeRegistration(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (password !== confirm) return { error: "Passwords don’t match." };

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
    return { error: "Your invitation link has expired or is invalid. Please ask the centre to re-invite you." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  const me = await api.get<{ roles: string[] }>("/people/me");
  redirect(clientHomeFor(me.roles as AppRole[]));
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address.", email };

  const supabase = await createClient();
  // The emailed link comes back through /auth/confirm, which signs the person in just long
  // enough to choose a new password on /reset-password.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await requestOrigin()}/auth/confirm?next=/reset-password`,
  });
  if (error?.status === 429) return { error: "Too many requests. Wait a minute, then try again.", email };

  // The same answer whether or not the address has an account, so this page can't be used to
  // find out who is registered.
  return {
    message: `If ${email} has a Skolopals account, we've emailed it a link to choose a new password. Check your spam or promotions folder too.`,
    email,
  };
}

export async function resetPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (password !== confirm) return { error: "Passwords don’t match." };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { error: "Your reset link has expired or has already been used. Ask for a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  const me = await api.get<{ roles: string[] }>("/people/me");
  const roles = me.roles as AppRole[];
  if (roles.includes("admin") && !roles.some((r) => CLIENT_ROLES.includes(r))) {
    await supabase.auth.signOut();
    return { message: "Your password has been changed. Sign in on the Admin Portal." };
  }
  redirect(clientHomeFor(roles));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
