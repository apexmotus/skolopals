"use client";

import { useActionState } from "react";
import { Button, FormMessage, Textarea } from "@/components/ui";
import { acknowledgeReport, type ActionState } from "../actions";

export function AcknowledgeForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(acknowledgeReport, {});

  if (state.ok) {
    return <p className="text-[12px] text-success">Thank you — the centre has your response.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="report_id" value={reportId} />
      <p className="text-[12px] font-bold text-ink">Let the centre know you have read this</p>
      <Textarea name="comment" rows={2} placeholder="Anything you would like to add (optional)" />
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" variant="secondary" className="w-fit" disabled={pending}>
        {pending ? "Sending…" : "I have read this report"}
      </Button>
    </form>
  );
}
