"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, Input } from "@/components/ui";
import { sendMessage, type MessageState } from "@/app/student/actions";

export function MessageComposer({ recipientId }: { recipientId: string }) {
  const [state, action, pending] = useActionState<MessageState, FormData>(sendMessage, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-[6px]">
      <input type="hidden" name="recipient_id" value={recipientId} />
      <Field label="Reply" htmlFor="body" error={state.error}>
        <div className="flex gap-2">
          <Input id="body" name="body" placeholder="Write a message…" autoComplete="off" maxLength={4000} required />
          <button
            disabled={pending}
            className="shrink-0 rounded-[6px] border border-line bg-brand px-[18px] text-[13px] text-white disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </Field>
    </form>
  );
}
