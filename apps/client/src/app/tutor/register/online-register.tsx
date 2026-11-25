"use client";

import { useActionState } from "react";
import { Button, FormMessage, Select } from "@skolopals/ui/ui";
import { time } from "@skolopals/shared/format";
import { confirmOnlineRegister, type ActionState } from "../actions";

export type OnlineLearner = {
  id: string;
  name: string;
  /** The first click on the join link, if any. */
  joinedAt: string | null;
  /** What the register says now, or the suggestion from the join list if it has never been saved. */
  status: string;
  saved: boolean;
};

/**
 * The register for an online or hybrid session. A click on the join link shows the learner opened it,
 * not that they stayed, so the tutor confirms every line before anything is saved.
 */
export function OnlineRegister({ sessionId, learners }: { sessionId: string; learners: OnlineLearner[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(confirmOnlineRegister, {});
  const anyUnsaved = learners.some((l) => !l.saved);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <p className="text-[12px] text-muted">
        {anyUnsaved
          ? "Suggested from who opened the join link. Check each line against who was really in the call, then confirm."
          : "Saved. Change any line and confirm again if it was wrong."}
      </p>
      <div className="flex flex-col">
        {learners.map((l) => (
          <div key={l.id} className="flex flex-col gap-2 border-t border-line py-3 first:border-0 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex flex-col">
              <span className="text-[13px] font-semibold text-ink">{l.name}</span>
              <span className="text-[11px] text-muted">{l.joinedAt ? `Joined ${time(l.joinedAt)}` : "Didn’t open the link"}</span>
            </span>
            {/* Keyed on the saved status, so the select resets to it after confirming. */}
            <Select
              key={`${l.status}-${l.saved}`}
              name={`status_${l.id}`}
              aria-label={`${l.name}’s attendance`}
              defaultValue={l.status}
              className="sm:max-w-[160px]"
            >
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </Select>
          </div>
        ))}
      </div>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">Register saved. Parents see it now.</FormMessage> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Confirm register"}
      </Button>
    </form>
  );
}
