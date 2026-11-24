"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "./button-styles";

/**
 * Modal built on the native <dialog>: showModal() gives the focus trap, the
 * inert background and the top layer for free. Centred from sm up; a
 * full-screen sheet on phones, with the header and footer pinned so the
 * actions stay reachable however long the body is.
 *
 * Controlled: the parent owns `open`. Esc and the close button call `onClose`
 * rather than closing directly, so the parent's state never drifts.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  header,
  footer,
  dismissible = true,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Rendered under the title, above the scrolling body. A Stepper goes here. */
  header?: ReactNode;
  footer?: ReactNode;
  /** false: no close button, Esc and backdrop clicks do nothing. For flows that must not be lost by accident. */
  dismissible?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The page behind a modal should not scroll.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        // A click on the <dialog> itself, not its content, is a backdrop click.
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
      className={cx(
        "m-auto flex-col overflow-hidden border border-line bg-surface p-0 text-left text-muted backdrop:bg-black/60 open:flex",
        "max-sm:h-dvh max-sm:max-h-none max-sm:w-screen max-sm:max-w-none",
        "sm:max-h-[min(90dvh,820px)] sm:w-[min(92vw,560px)] sm:rounded-[14px] sm:shadow-card",
        className,
      )}
    >
      <div className="flex shrink-0 flex-col gap-3 border-b border-line px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-[18px] font-bold leading-[1.35] text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-[13px] leading-[1.5]">
                {description}
              </p>
            ) : null}
          </div>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/[0.08] hover:text-ink"
            >
              <X aria-hidden size={20} />
            </button>
          ) : null}
        </div>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      {footer ? (
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
