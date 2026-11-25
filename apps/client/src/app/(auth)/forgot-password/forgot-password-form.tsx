"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormMessage, Input, PageHeading } from "@skolopals/ui/ui";
import { requestPasswordReset, type AuthState } from "../actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <PageHeading
        title="Forgot your password?"
        description="Enter the email address you signed up with and we’ll send you a link to choose a new one."
      />
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" defaultValue={state.email} required />
      </Field>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.message ? <FormMessage tone="success">{state.message}</FormMessage> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-[12px] text-muted">
        Remembered it?{" "}
        <Link href="/login" className="text-accent underline-offset-2 hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}
