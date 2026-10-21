"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import { replyToThread, startThread, type MessageState } from "./actions";

export function NewThreadForm({
  recipients,
  learners,
}: {
  recipients: { id: string; name: string }[];
  learners: { id: string; full_name: string }[];
}) {
  const [state, action, pending] = useActionState<MessageState, FormData>(startThread, {});

  if (recipients.length === 0) {
    return (
      <Card>
        <CardTitle>Start a conversation</CardTitle>
        <p className="text-[13px] text-muted">There is nobody to message yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Start a conversation</CardTitle>
      <form action={action} className="flex flex-col gap-3">
        <Field label="To" htmlFor="participant">
          <Select id="participant" name="participant" required>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        {learners.length > 0 ? (
          <Field label="About" htmlFor="learner_id">
            <Select id="learner_id" name="learner_id" defaultValue="">
              <option value="">Not about a particular learner</option>
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Subject" htmlFor="subject">
          <Input id="subject" name="subject" placeholder="What it is about" />
        </Field>
        <Field label="Message" htmlFor="body">
          <Textarea id="body" name="body" rows={4} required />
        </Field>
        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        {state.ok ? <FormMessage tone="success">Sent.</FormMessage> : null}
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </form>
    </Card>
  );
}

export function ReplyForm({ threadId }: { threadId: string }) {
  const [state, action, pending] = useActionState<MessageState, FormData>(replyToThread, {});
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="thread_id" value={threadId} />
      <Textarea name="body" rows={2} placeholder="Reply…" required />
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" variant="secondary" className="w-fit" disabled={pending}>
        {pending ? "Sending…" : "Reply"}
      </Button>
    </form>
  );
}
