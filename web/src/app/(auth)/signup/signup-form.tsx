"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormMessage, Input, PageHeading } from "@/components/ui";
import { signup, type AuthState } from "../actions";

/**
 * Parents and guardians register themselves. There is no account-type
 * choice: tutors and administrators are created by the centre, so a role
 * can never be self-selected here (BR-23).
 */
export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <PageHeading
        title="Create your account"
        description="For parents and guardians. You can register your learners once you are signed in."
      />
      <Field label="Your full name" htmlFor="full_name">
        <Input id="full_name" name="full_name" autoComplete="name" placeholder="Thandi Mokoena" required />
      </Field>
      <Field label="Email address" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={state.email}
          required
        />
      </Field>
      <Field label="Mobile number" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="072 123 4567" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
          required
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.message ? <FormMessage tone="success">{state.message}</FormMessage> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-[12px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-brand underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
