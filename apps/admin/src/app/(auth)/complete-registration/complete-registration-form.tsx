"use client";

import { useActionState, useSyncExternalStore } from "react";
import { Button, Field, FormMessage, Input, PageHeading } from "@skolopals/ui/ui";
import { completeRegistration, type AuthState } from "../actions";

const subscribeToHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

export function CompleteRegistrationForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(completeRegistration, {});
  // The invite link's session (or its failure reason) arrives in the URL fragment.
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
  const params = new URLSearchParams(hash.slice(1));
  const link = {
    accessToken: params.get("access_token") ?? "",
    refreshToken: params.get("refresh_token") ?? "",
    error: params.get("error_description") ?? "",
  };

  const error = state.error ?? (link.error ? `${link.error}. Please ask an administrator to re-invite you.` : "");

  return (
    <form action={action} className="flex flex-col gap-4">
      <PageHeading title="Complete your registration" description="Create a password to finish setting up your administrator account." />
      <input type="hidden" name="access_token" value={link.accessToken} />
      <input type="hidden" name="refresh_token" value={link.refreshToken} />
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" placeholder="••••••••" minLength={8} required />
      </Field>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Create password"}
      </Button>
    </form>
  );
}
