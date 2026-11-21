"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cx } from "./button-styles";

export type Step = { id: string; label: string; href?: string };

/**
 * Where the user is in a multi-step flow. From md up: every step, labelled.
 * On phones: "Step 3 of 6 · Subjects" and a progress bar, which fits any width.
 * Completed steps can be revisited through `href` or `onSelect`; later steps cannot.
 */
export function Stepper({
  steps,
  current,
  onSelect,
  label = "Progress",
  className,
}: {
  steps: Step[];
  /** Zero-based index of the step the user is on. */
  current: number;
  onSelect?: (index: number) => void;
  label?: string;
  className?: string;
}) {
  const at = Math.min(Math.max(current, 0), steps.length - 1);
  const percent = steps.length > 1 ? Math.round((at / (steps.length - 1)) * 100) : 100;

  return (
    <nav aria-label={label} className={cx("w-full", className)}>
      <div className="flex flex-col gap-2 md:hidden">
        <p className="text-[13px] text-muted">
          <span className="font-bold text-ink">
            Step {at + 1} of {steps.length}
          </span>{" "}
          · {steps[at]?.label}
        </p>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={at + 1}
          aria-valuetext={`Step ${at + 1} of ${steps.length}: ${steps[at]?.label}`}
          className="h-[6px] w-full overflow-hidden rounded-full bg-subtle"
        >
          <div className="h-full rounded-full bg-purple transition-[width]" style={{ width: `${Math.max(percent, 4)}%` }} />
        </div>
      </div>

      <ol className="hidden items-start md:flex">
        {steps.map((step, i) => {
          const state = i < at ? "done" : i === at ? "current" : "upcoming";
          const marker = (
            <span
              className={cx(
                "relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                state === "done" && "bg-purple text-white",
                state === "current" && "bg-sun text-plum-950 ring-4 ring-sun-soft",
                state === "upcoming" && "border border-line bg-white text-muted",
              )}
            >
              {state === "done" ? <Check aria-hidden size={16} strokeWidth={2.5} /> : i + 1}
            </span>
          );
          const text = (
            <span
              className={cx(
                "text-center text-[12px] leading-[1.3]",
                state === "upcoming" ? "text-muted" : "font-semibold text-ink",
              )}
            >
              {step.label}
            </span>
          );
          const body = (
            <>
              {marker}
              {text}
            </>
          );
          const itemClass = "flex flex-col items-center gap-2 rounded-[8px] px-1";

          return (
            <li
              key={step.id}
              aria-current={state === "current" ? "step" : undefined}
              className="relative flex flex-1 flex-col items-center"
            >
              {i > 0 ? (
                <span
                  aria-hidden
                  className={cx(
                    "absolute right-1/2 top-[15px] h-[2px] w-full",
                    i <= at ? "bg-purple" : "bg-line",
                  )}
                />
              ) : null}
              {state === "done" && step.href ? (
                <Link href={step.href} className={cx(itemClass, "hover:opacity-80")}>
                  {body}
                </Link>
              ) : state === "done" && onSelect ? (
                <button type="button" onClick={() => onSelect(i)} className={cx(itemClass, "hover:opacity-80")}>
                  {body}
                </button>
              ) : (
                <span className={itemClass}>{body}</span>
              )}
              <span className="sr-only">{state === "done" ? "(completed)" : state === "upcoming" ? "(not started)" : ""}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
