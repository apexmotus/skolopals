"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input, PageHeading } from "@skolopals/ui/ui";
import { login, type AuthState } from "../actions";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, {
    error: initialError,
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      <PageHeading title="Admin Sign In" description="Sign in to manage Skolopals Tutoring Centre." />
      <input type="hidden" name="next" value={next} />
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="admin@skolopals.co.za" defaultValue={state.email} required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
      </Field>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Logging in…" : "Login"}
      </Button>
    </form>
  );
}
