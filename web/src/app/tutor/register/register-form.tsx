"use client";

import { useActionState } from "react";
import { FormMessage, cx } from "@/components/ui";
import { markAttendance, type ActionState } from "../actions";

const OPTIONS = [
  { value: "present", label: "Present", tone: "bg-success-soft text-success" },
  { value: "late", label: "Late", tone: "bg-warning-soft text-warning" },
  { value: "absent", label: "Absent", tone: "bg-danger-soft text-danger" },
  { value: "excused", label: "Excused", tone: "bg-[rgba(104,113,125,0.09)] text-muted" },
] as const;

export function RegisterRow({
  sessionId,
  learnerId,
  learnerName,
  current,
}: {
  sessionId: string;
  learnerId: string;
  learnerName: string;
  current: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(markAttendance, {});

  return (
    <div className="flex flex-col gap-2 border-t border-line py-3 first:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink">{learnerName}</span>
        <form action={action} className="flex flex-wrap gap-2">
          <input type="hidden" name="session_id" value={sessionId} />
          <input type="hidden" name="learner_id" value={learnerId} />
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="submit"
              name="status"
              value={o.value}
              disabled={pending}
              className={cx(
                "rounded-full px-3 py-[6px] text-[11px] font-semibold",
                current === o.value ? o.tone : "bg-subtle text-muted hover:bg-canvas",
              )}
            >
              {o.label}
            </button>
          ))}
        </form>
      </div>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
    </div>
  );
}
