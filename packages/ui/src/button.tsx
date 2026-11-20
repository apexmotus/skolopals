"use client";

import { useRef, useState, type ComponentProps, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./button-styles";
import { LoadingScreen } from "./loading-screen";

/**
 * Button that locks itself once clicked so it cannot be fired twice.
 *
 * - Inside a `<form>`, it disables while the form action is pending and shows
 *   the full-screen loader (which also blocks any other clicks).
 * - With an async `onClick`, it disables until the returned promise settles.
 */
export function Button({
  variant = "primary",
  className,
  disabled,
  onClick,
  type,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  const { pending: formPending } = useFormStatus();
  const [clickPending, setClickPending] = useState(false);
  const inFlight = useRef(false);

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (inFlight.current) {
      event.preventDefault();
      return;
    }
    const result: unknown = onClick?.(event);
    if (result instanceof Promise) {
      inFlight.current = true;
      setClickPending(true);
      try {
        await result;
      } finally {
        inFlight.current = false;
        setClickPending(false);
      }
    }
  }

  const showLoader = formPending && (type === undefined || type === "submit");

  return (
    <>
      <button
        type={type}
        className={buttonClass(variant, className)}
        disabled={disabled || formPending || clickPending}
        aria-busy={formPending || clickPending || undefined}
        onClick={handleClick}
        {...props}
      />
      {showLoader ? createPortal(<LoadingScreen label="Working" />, document.body) : null}
    </>
  );
}
