"use client";

import { useActionState } from "react";
import { Button, FormMessage } from "@skolopals/ui/ui";
import { joinSession, type JoinState } from "./actions";

export function JoinForm({ sessionId, learners }: { sessionId: string; learners: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinSession, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="session_id" value={sessionId} />
      {learners.length === 1 ? (
        <input type="hidden" name="learner_id" value={learners[0]!.id} />
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1 text-[13px] font-semibold text-ink">Who is joining?</legend>
          {learners.map((l) => (
            <label key={l.id} className="flex items-center gap-3 rounded-[8px] border border-line bg-surface p-3 text-[13px] text-ink">
              <input type="radio" name="learner_id" value={l.id} required className="size-4" />
              {l.name}
            </label>
          ))}
        </fieldset>
      )}
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" className="w-full sm:w-fit" disabled={pending}>
        {pending ? "Opening the class…" : learners.length === 1 ? `Join as ${learners[0]!.name.split(" ")[0]}` : "Join the class"}
      </Button>
    </form>
  );
}
