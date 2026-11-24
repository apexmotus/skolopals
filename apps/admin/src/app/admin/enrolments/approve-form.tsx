"use client";

import { useActionState, useState } from "react";
import { Button, DetailRow, Field, FormMessage, Input, Textarea } from "@skolopals/ui/ui";
import { Dialog } from "@skolopals/ui/dialog";
import { money } from "@skolopals/shared/format";
import {
  acceptApplication,
  activateApplication,
  allowRetake,
  declineApplication,
  requestInformation,
  type ApproveState,
} from "./actions";

/** `GET /enrolments/quote`: what accepting today asks the parent for. */
export type Quote = {
  registrationCents: number;
  tuitionCents: number;
  totalCents: number;
  daysCharged: number;
  daysInMonth: number;
};

const DECLINE_REASONS = [
  "No class available for this grade/subject",
  "Needs a different programme",
  "Incomplete information",
];

/** Accept, with a confirm step showing exactly what the parent will be asked to pay (§4.4). */
export function AcceptForm({ enrolmentId, quote, reaccept }: { enrolmentId: string; quote: Quote | null; reaccept?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ApproveState, FormData>(acceptApplication, {});
  return (
    <>
      <Button type="button" className="w-fit" onClick={() => setOpen(true)}>
        {reaccept ? "Accept again" : "Accept"}
      </Button>
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={reaccept ? "Accept this application again?" : "Accept this application?"}
          description="An invoice is raised now and the family is asked to pay within 7 days."
          footer={
            <form action={action} className="flex justify-end gap-3">
              <input type="hidden" name="enrolment_id" value={enrolmentId} />
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Accepting…" : "Accept and send the invoice"}
              </Button>
            </form>
          }
        >
          <div className="flex flex-col gap-3 text-[14px]">
            {quote ? (
              <>
                {quote.registrationCents > 0 ? <DetailRow label="Registration fee" value={money(quote.registrationCents)} /> : null}
                {quote.tuitionCents > 0 ? (
                  <DetailRow
                    label={`Tuition, rest of this month (${quote.daysCharged} of ${quote.daysInMonth} days)`}
                    value={money(quote.tuitionCents)}
                  />
                ) : null}
                <div className="border-t border-line pt-3">
                  <DetailRow label="The parent will be asked for" value={money(quote.totalCents)} />
                </div>
              </>
            ) : (
              <p className="text-muted">The amount is worked out when you accept.</p>
            )}
            {state.error ? <FormMessage>{state.error}</FormMessage> : null}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

export function DeclineForm({ enrolmentId }: { enrolmentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState<ApproveState, FormData>(declineApplication, {});
  return (
    <>
      <Button type="button" variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
        Decline
      </Button>
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Decline this application?"
          description="The family is told the reason. No invoice exists, so nothing needs refunding."
          footer={
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" form={`decline-${enrolmentId}`} variant="danger" disabled={pending || !reason}>
                {pending ? "Declining…" : "Decline"}
              </Button>
            </div>
          }
        >
          <form id={`decline-${enrolmentId}`} action={action} className="flex flex-col gap-3">
            <input type="hidden" name="enrolment_id" value={enrolmentId} />
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-2 text-[12px] font-semibold text-ink">Reason</legend>
              {[...DECLINE_REASONS, "other"].map((r) => (
                <label key={r} className="flex items-center gap-2 text-[14px] text-ink">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                  {r === "other" ? "Other" : r}
                </label>
              ))}
            </fieldset>
            {reason === "other" ? (
              <Field label="Describe the reason" htmlFor="reason_other">
                <Input id="reason_other" name="reason_other" maxLength={300} required />
              </Field>
            ) : null}
            <Field label="Message to the parent (optional)" htmlFor="decline_message">
              <Textarea id="decline_message" name="message" rows={3} maxLength={2000} />
            </Field>
            {state.error ? <FormMessage>{state.error}</FormMessage> : null}
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

export function RequestInfoForm({
  learnerId,
  guardianIds,
}: {
  learnerId: string;
  guardianIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ApproveState, FormData>(requestInformation, {});
  return (
    <>
      <Button type="button" variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
        Request more information
      </Button>
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Ask the family for more information"
          description="The application stays where it is. For a clearer report card, the parent can replace it from their portal."
          footer={
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
              {state.ok ? null : (
                <Button type="submit" form={`info-${learnerId}`} disabled={pending}>
                  {pending ? "Sending…" : "Send"}
                </Button>
              )}
            </div>
          }
        >
          <form id={`info-${learnerId}`} action={action} className="flex flex-col gap-3">
            <input type="hidden" name="learner_id" value={learnerId} />
            {guardianIds.map((g) => (
              <input key={g} type="hidden" name="guardian_id" value={g} />
            ))}
            {state.ok ? (
              <FormMessage tone="success">{state.ok}</FormMessage>
            ) : (
              <Field label="Message" htmlFor="info_body">
                <Textarea
                  id="info_body"
                  name="body"
                  rows={4}
                  maxLength={4000}
                  placeholder="e.g. The report card photo is hard to read. Please upload a clearer copy."
                  required
                />
              </Field>
            )}
            {state.error ? <FormMessage>{state.error}</FormMessage> : null}
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

/** Admin retry when payment verification did not activate (stage `activation`). */
export function ActivateForm({ enrolmentId }: { enrolmentId: string }) {
  const [state, action, pending] = useActionState<ApproveState, FormData>(activateApplication, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="enrolment_id" value={enrolmentId} />
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Activating…" : "Activate now"}
      </Button>
    </form>
  );
}

/** Lets the learner sit the test again, e.g. after a bad connection or a sibling answering. */
export function RetakeForm({ enrolmentId, attemptId }: { enrolmentId: string; attemptId: string }) {
  const [state, action, pending] = useActionState<ApproveState, FormData>(allowRetake, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="enrolment_id" value={enrolmentId} />
      <input type="hidden" name="attempt_id" value={attemptId} />
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <Button variant="secondary" type="submit" className="w-fit" disabled={pending}>
        {pending ? "Setting aside…" : "Let them take the test again"}
      </Button>
    </form>
  );
}
