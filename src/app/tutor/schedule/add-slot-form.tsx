"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import { addSlot, type SlotState } from "../actions";

export function AddSlotForm() {
  const [state, action, pending] = useActionState<SlotState, FormData>(addSlot, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Date" htmlFor="slot-date">
          <Input id="slot-date" name="date" type="date" required className="w-[180px]" />
        </Field>
        <Field label="Start time (UK)" htmlFor="slot-time">
          <Input id="slot-time" name="time" type="time" step={900} required className="w-[140px]" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add time slot"}
        </Button>
      </div>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
    </form>
  );
}
