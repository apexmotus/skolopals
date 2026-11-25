"use client";

import { useActionState } from "react";
import { Button, FormMessage, Input, Select } from "@skolopals/ui/ui";
import { cancelSession, reinstateSession, setSubstitute, type SessionState } from "./actions";

function Result({ state }: { state: SessionState }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

export function CancelSessionForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState<SessionState, FormData>(cancelSession, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="session_id" value={sessionId} />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="reason"
          aria-label="Reason for cancelling"
          placeholder="Reason, e.g. load-shedding"
          className="max-w-[260px]"
          required
        />
        <label className="flex items-center gap-1 text-[12px] text-muted">
          <input type="checkbox" name="notify" defaultChecked /> Tell the families
        </label>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Cancelling…" : "Cancel session"}
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function ReinstateSessionForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState<SessionState, FormData>(reinstateSession, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="session_id" value={sessionId} />
      <Button type="submit" variant="secondary" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Put it back on"}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function SubstituteForm({
  sessionId,
  current,
  tutors,
}: {
  sessionId: string;
  current: string | null;
  tutors: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<SessionState, FormData>(setSubstitute, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="session_id" value={sessionId} />
      <div className="flex flex-wrap items-center gap-2">
        {/* Keyed on the saved substitute: the form resets after saving, and must reset to the new value. */}
        <Select
          key={current ?? ""}
          name="tutor_id"
          aria-label="Substitute tutor"
          defaultValue={current ?? ""}
          className="max-w-[260px]"
        >
          <option value="">No substitute (class tutor)</option>
          {tutors.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save cover"}
        </Button>
      </div>
      {tutors.length === 0 ? (
        <p className="text-[11px] text-muted">No other tutor is recorded as teaching this subject at these grades.</p>
      ) : null}
      <Result state={state} />
    </form>
  );
}
