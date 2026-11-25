"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select, Textarea } from "@skolopals/ui/ui";
import { sendAnnouncement, type AnnouncementState } from "./actions";

export function AnnouncementForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AnnouncementState, FormData>(sendAnnouncement, {});

  return (
    <Card>
      <CardTitle>Send an announcement</CardTitle>
      <p className="text-[11px] text-muted">
        It appears in each person&rsquo;s notifications in their portal. Nothing is emailed or sent by WhatsApp.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <Field label="Send to" htmlFor="audience">
          <Select id="audience" name="audience" required defaultValue="parents">
            <option value="parents">All parents and guardians</option>
            <option value="tutors">All tutors</option>
            <option value="everyone">Everyone with an account</option>
            {classes.length > 0 ? (
              <optgroup label="Families in one class">
                {classes.map((c) => (
                  <option key={c.id} value={`class:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
        </Field>
        <Field label="Title" htmlFor="title">
          <Input id="title" name="title" maxLength={200} placeholder="No classes on Monday 16 December" required />
        </Field>
        <Field label="Message (optional)" htmlFor="body">
          <Textarea id="body" name="body" rows={4} maxLength={2000} placeholder="Add the details families need." />
        </Field>
        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Sending…" : "Send announcement"}
        </Button>
      </form>
    </Card>
  );
}
