"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import { sendEnquiry, type FormState } from "../actions";

const TOPICS = [
  "Enrolling my child",
  "Fees and payments",
  "Holiday programmes",
  "An existing learner",
  "Something else",
];

/** How the enquirer found us. Feeds the enquiry KPI (BP section 24). */
const SOURCES = [
  { value: "website", label: "Found the website" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
  { value: "flyer", label: "A flyer" },
  { value: "referral", label: "Another parent told me" },
  { value: "walk_in", label: "Walked past the centre" },
  { value: "other", label: "Somewhere else" },
];

export function ContactForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(sendEnquiry, {});
  const v = state.values ?? {};

  return (
    <Card className="min-w-0 flex-1">
      <CardTitle>Send us a message</CardTitle>
      {state.ok ? (
        <FormMessage tone="success">
          Thank you — we have your message and will be in touch.
        </FormMessage>
      ) : (
        <form action={action} className="flex flex-col gap-[14px]">
          <Field label="Your name" htmlFor="full_name">
            <Input
              id="full_name"
              name="full_name"
              autoComplete="name"
              placeholder="Thandi Mokoena"
              defaultValue={v.full_name}
              required
            />
          </Field>

          {/* Either is enough: plenty of parents reach us on WhatsApp and
              do not use email. */}
          <Field label="Phone or WhatsApp number" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="072 123 4567"
              defaultValue={v.phone}
            />
          </Field>
          <Field label="Email address" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              defaultValue={v.email}
            />
          </Field>
          <p className="-mt-2 text-[11px] text-muted">
            Give us a phone number or an email address — whichever suits you.
          </p>

          <Field label="What is it about?" htmlFor="topic">
            <Select id="topic" name="topic" defaultValue={v.topic || TOPICS[0]}>
              {TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="How did you hear about us?" htmlFor="source">
            <Select id="source" name="source" defaultValue="website">
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Message" htmlFor="message">
            <Textarea
              id="message"
              name="message"
              rows={4}
              placeholder="Tell us a little about your child and what they need help with"
              defaultValue={v.message}
              required
            />
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
