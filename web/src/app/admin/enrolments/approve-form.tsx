"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { approveEnrolment, declineEnrolment, type ApproveState } from "./actions";

export function ApproveForm({
  enrolmentId,
  tutors,
  preferredTutorId,
  today,
}: {
  enrolmentId: string;
  tutors: { id: string; full_name: string }[];
  preferredTutorId: string | null;
  today: string;
}) {
  const [state, action, pending] = useActionState<ApproveState, FormData>(approveEnrolment, {});
  const [declineState, declineAction, declining] = useActionState<ApproveState, FormData>(
    declineEnrolment,
    {},
  );

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="enrolment_id" value={enrolmentId} />
        <Field label="Assign tutor" htmlFor={`tutor-${enrolmentId}`}>
          <Select id={`tutor-${enrolmentId}`} name="assigned_tutor_id" defaultValue={preferredTutorId ?? ""} required>
            <option value="">Choose a tutor</option>
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
                {t.id === preferredTutorId ? " — requested" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start date" htmlFor={`start-${enrolmentId}`}>
          <Input id={`start-${enrolmentId}`} name="start_date" type="date" defaultValue={today} required />
        </Field>
        <Field label="First month fee in Rand (optional)" htmlFor={`fm-${enrolmentId}`}>
          <Input
            id={`fm-${enrolmentId}`}
            name="first_month_rand"
            inputMode="decimal"
            placeholder="Leave blank for the full package price"
          />
        </Field>
        <Field label="Reason for the first-month amount" htmlFor={`reason-${enrolmentId}`}>
          <Input id={`reason-${enrolmentId}`} name="reason" placeholder="e.g. joined 18 October, part month" />
        </Field>
        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Activating…" : "Approve and activate"}
        </Button>
      </form>
      <form action={declineAction}>
        <input type="hidden" name="enrolment_id" value={enrolmentId} />
        {declineState.error ? <FormMessage>{declineState.error}</FormMessage> : null}
        <button
          type="submit"
          disabled={declining}
          className="text-[12px] text-muted underline-offset-2 hover:underline"
        >
          {declining ? "Declining…" : "Decline this enrolment"}
        </button>
      </form>
    </div>
  );
}
