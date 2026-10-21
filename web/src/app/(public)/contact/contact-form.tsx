"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import { sendEnquiry, type FormState } from "../actions";

const TOPICS = ["Booking support", "Payments and refunds", "Becoming a tutor", "Safeguarding", "Something else"];

export function ContactForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(sendEnquiry, {});
  const v = state.values ?? {};

  return (
    <Card className="min-w-0 flex-1">
      <CardTitle>Send a message</CardTitle>
      {state.ok ? (
        <FormMessage tone="success">Thanks — your message is with our team. We’ll reply within one business day.</FormMessage>
      ) : (
        <form action={action} className="flex flex-col gap-[14px]">
          <Field label="Name" htmlFor="name">
            <Input id="name" name="full_name" autoComplete="name" placeholder="Your name" defaultValue={v.name} required />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" defaultValue={v.email} required />
          </Field>
          <Field label="Topic" htmlFor="topic">
            <Select id="topic" name="topic" defaultValue={v.topic || TOPICS[0]}>
              {TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Message" htmlFor="message">
            <Textarea id="message" name="message" rows={3} placeholder="Tell us how we can help…" defaultValue={v.message} required />
          </Field>
          {state.error ? <FormMessage>{state.error}</FormMessage> : null}
          <Button type="submit" className="w-fit" disabled={pending}>
            {pending ? "Sending…" : "Send message"}
          </Button>
        </form>
      )}
    </Card>
  );
}
