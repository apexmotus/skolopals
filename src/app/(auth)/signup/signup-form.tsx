"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Field, FormMessage, Input, PageHeading, cx } from "@/components/ui";
import { signup, type AuthState } from "../actions";

const ROLES = [
  { value: "student", title: "I’m a student / parent", body: "Find tutors and book lessons" },
  { value: "tutor", title: "I’m a tutor", body: "Apply and teach learners" },
] as const;

export function SignupForm({ defaultRole }: { defaultRole: "student" | "tutor" }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, {});
  const [role, setRole] = useState<string>(defaultRole);

  return (
    <form action={action} className="flex flex-col gap-4">
      <PageHeading title="Create your account" description="Choose how you’ll use Skolopals." />
      <fieldset className="flex flex-col gap-3 sm:flex-row">
        <legend className="sr-only">Account type</legend>
        {ROLES.map((r) => (
          <label
            key={r.value}
            className={cx(
              "flex flex-1 cursor-pointer flex-col gap-[14px] rounded-[10px] border bg-white p-5 shadow-card",
              role === r.value ? "border-brand ring-1 ring-brand" : "border-line",
            )}
          >
            <input
              type="radio"
              name="role"
              value={r.value}
              checked={role === r.value}
              onChange={() => setRole(r.value)}
              className="sr-only"
            />
            <span className="text-[20px] font-bold text-ink">{r.title}</span>
            <span className="text-[12px] text-muted">{r.body}</span>
          </label>
        ))}
      </fieldset>
      <Field label="Full name" htmlFor="full_name">
        <Input id="full_name" name="full_name" autoComplete="name" placeholder="Alex Morgan" required />
      </Field>
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" defaultValue={state.email} required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="••••••••" minLength={8} required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" placeholder="••••••••" minLength={8} required />
      </Field>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.message ? <FormMessage tone="success">{state.message}</FormMessage> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-[12px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-brand underline-offset-2 hover:underline">
          Login
        </Link>
      </p>
    </form>
  );
}
