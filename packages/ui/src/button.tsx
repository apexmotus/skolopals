"use client";

import { useEffect, useRef, useState, type ComponentProps, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./button-styles";
import { LoadingScreen } from "./loading-screen";

const LOADER_DELAY_MS = 400;

/**
 * Button that locks itself once clicked so it cannot be fired twice.
 *
 * - Inside a `<form>`, it disables while the form action is pending and, if the
 *   action is still running after LOADER_DELAY_MS, shows the full-screen loader
 *   (which also blocks any other clicks). Quick actions never flash it.
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

  const isSubmit = type === undefined || type === "submit";
  const [showLoader, setShowLoader] = useState(false);
  useEffect(() => {
    if (!(formPending && isSubmit)) return;
    const timer = setTimeout(() => setShowLoader(true), LOADER_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setShowLoader(false);
    };
  }, [formPending, isSubmit]);

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
