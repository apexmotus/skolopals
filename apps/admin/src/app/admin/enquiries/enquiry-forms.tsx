"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select, Textarea } from "@skolopals/ui/ui";
import { ENQUIRY_SOURCE_LABEL } from "@skolopals/shared/format";
import { convertEnquiry, logEnquiry, setEnquiryStatus, type EnquiryState } from "./actions";

function Result({ state }: { state: EnquiryState }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

/** The website files its own enquiries, so it isn't offered here. */
const LOGGABLE_SOURCES = Object.entries(ENQUIRY_SOURCE_LABEL).filter(([code]) => code !== "website");

export function LogEnquiryForm() {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(logEnquiry, {});

  return (
    <Card>
      <CardTitle>Log an enquiry</CardTitle>
      <p className="text-[11px] text-muted">
        For enquiries by phone, WhatsApp or at the door. Website enquiries arrive here on their own.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Name" htmlFor="full_name">
            <Input id="full_name" name="full_name" required />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" />
          </Field>
          <Field label="Email (optional)" htmlFor="email">
            <Input id="email" name="email" type="email" />
          </Field>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="How they reached us" htmlFor="source">
            <Select id="source" name="source" defaultValue="phone">
              {LOGGABLE_SOURCES.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Topic (optional)" htmlFor="topic">
            <Input id="topic" name="topic" placeholder="Grade 10 maths, fees, holiday programme…" />
          </Field>
        </div>
        <Field label="What they asked" htmlFor="message">
          <Textarea id="message" name="message" rows={3} required />
        </Field>
        <Result state={state} />
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Saving…" : "Log enquiry"}
        </Button>
      </form>
    </Card>
  );
}

export function EnquiryStatusForm({ enquiryId, status }: { enquiryId: string; status: string }) {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(setEnquiryStatus, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="enquiry_id" value={enquiryId} />
      <Field label="Status" htmlFor={`status-${enquiryId}`}>
        {/* Keyed on the saved status: the form resets after saving, and must reset to the new value. */}
        <Select
          key={status}
          id={`status-${enquiryId}`}
          name="status"
          defaultValue={status === "enrolled" ? "closed" : status}
        >
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
        </Select>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Update"}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function ConvertEnquiryForm({
  enquiryId,
  learners,
}: {
  enquiryId: string;
  learners: { id: string; full_name: string }[];
}) {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(convertEnquiry, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="enquiry_id" value={enquiryId} />
      <Field label="They enrolled as" htmlFor={`learner-${enquiryId}`}>
        <Select id={`learner-${enquiryId}`} name="learner_id" defaultValue="">
          <option value="" disabled>
            Choose a learner
          </option>
          {learners.map((l) => (
            <option key={l.id} value={l.id}>
              {l.full_name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Mark as enrolled"}
      </Button>
      <Result state={state} />
    </form>
  );
}
