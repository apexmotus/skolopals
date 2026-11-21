"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Button, ButtonLink, Field, FormMessage, Input, PageHeading } from "@skolopals/ui/ui";
import { signup, type AuthState } from "../actions";

/**
 * Parents and guardians register themselves. There is no account-type
 * choice: tutors and administrators are created by the centre, so a role
 * can never be self-selected here (BR-23).
 */
export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, {});
  const dialog = useRef<HTMLDialogElement>(null);

  // A successful sign-up returns a message rather than redirecting, because email confirmation
  // means there is no session yet. Show it as a modal instead of a line under a reset form.
  useEffect(() => {
    if (state.message && !dialog.current?.open) dialog.current?.showModal();
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <dialog
        ref={dialog}
        aria-labelledby="check-email-title"
        className="m-auto w-[calc(100%-32px)] max-w-[440px] rounded-[14px] border border-line bg-white p-6 text-center shadow-xl backdrop:bg-black/40"
      >
        <div className="flex flex-col items-center gap-3">
          <img src="/icons/message-square.svg" alt="" width={32} height={32} />
          <h2 id="check-email-title" className="text-[20px] font-bold text-ink">
            Check your email
          </h2>
          <p className="text-[13px] leading-[1.6] text-muted">
            We sent a confirmation link to <span className="font-semibold text-ink">{state.email}</span>.
            Click the link to activate your account, then log in.
          </p>
          <p className="text-[12px] text-muted">
            Can’t see it? Check your spam or promotions folder.
          </p>
          <div className="flex flex-wrap justify-center gap-[10px] pt-2">
            <ButtonLink href="/login">Go to log in</ButtonLink>
            <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>
              Close
            </Button>
          </div>
        </div>
      </dialog>
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
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-[12px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
