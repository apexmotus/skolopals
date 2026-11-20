"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormMessage, Input, PageHeading } from "@skolopals/ui/ui";
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
      <div className="flex flex-col gap-4 sm:flex-row">
        <Field label="First name" htmlFor="first_name" className="flex-1">
          <Input id="first_name" name="first_name" autoComplete="given-name" placeholder="Thandi" required />
        </Field>
        <Field label="Last name" htmlFor="last_name" className="flex-1">
          <Input id="last_name" name="last_name" autoComplete="family-name" placeholder="Mokoena" required />
        </Field>
      </div>
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
