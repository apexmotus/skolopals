"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormMessage, Input, PageHeading } from "@/components/ui";
import { login, type AuthState } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <PageHeading title="Welcome back" description="Sign in to continue learning." />
      <input type="hidden" name="next" value={next} />
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" defaultValue={state.email} required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
      </Field>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Logging in…" : "Login"}
      </Button>
      <p className="text-center text-[12px] text-muted">
        New to Skolopals?{" "}
        <Link href="/signup" className="text-brand underline-offset-2 hover:underline">
          Sign Up
        </Link>
      </p>
    </form>
  );
}
