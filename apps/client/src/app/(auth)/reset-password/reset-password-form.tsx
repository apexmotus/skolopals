"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormMessage, Input, PageHeading } from "@skolopals/ui/ui";
import { resetPassword, type AuthState } from "../actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPassword, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <PageHeading title="Choose a new password" description="Use at least 8 characters." />
      <Field label="New password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" placeholder="••••••••" minLength={8} required />
      </Field>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.message ? <FormMessage tone="success">{state.message}</FormMessage> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
      {state.error ? (
        <p className="text-center text-[12px] text-muted">
          <Link href="/forgot-password" className="text-accent underline-offset-2 hover:underline">
            Send me a new link
          </Link>
        </p>
      ) : null}
    </form>
  );
}
