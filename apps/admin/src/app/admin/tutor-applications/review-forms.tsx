"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormMessage, Textarea } from "@skolopals/ui/ui";
import { Dialog } from "@skolopals/ui/dialog";
import {
  approveApplication,
  markIdentityChecked,
  purgeApplication,
  requestPoliceClearance,
  setApplicationStatus,
  type TutorApplicationState,
} from "./actions";

function Result({ state }: { state: TutorApplicationState }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

/**
 * `done` hides the button once the step is done. The component stays mounted, so the confirmation
 * ("The applicant has been told") is still shown after the page refreshes without the button.
 */
export function ShortlistButton({ applicationId, done }: { applicationId: string; done: boolean }) {
  const [state, action, pending] = useActionState<TutorApplicationState, FormData>(setApplicationStatus, {});
  if (done) return <Result state={state} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="status" value="shortlisted" />
      <Button type="submit" variant="secondary" className="w-fit" disabled={pending}>
        {pending ? "Shortlisting…" : "Shortlist"}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function IdentityCheckedButton({ applicationId, done }: { applicationId: string; done: boolean }) {
  const [state, action, pending] = useActionState<TutorApplicationState, FormData>(markIdentityChecked, {});
  if (done) return <Result state={state} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="application_id" value={applicationId} />
      <Button type="submit" variant="secondary" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Mark identity checked"}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function RejectButton({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TutorApplicationState, FormData>(setApplicationStatus, {});
  return (
    <>
      <Button type="button" variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
        Reject
      </Button>
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Reject this application?"
          description="The applicant is told, with a standard message. Your note stays internal."
          footer={
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                {state.ok ? "Done" : "Cancel"}
              </Button>
              {state.ok ? null : (
                <Button type="submit" form={`reject-${applicationId}`} variant="danger" disabled={pending}>
                  {pending ? "Rejecting…" : "Reject"}
                </Button>
              )}
            </div>
          }
        >
          <form id={`reject-${applicationId}`} action={action} className="flex flex-col gap-3">
            <input type="hidden" name="application_id" value={applicationId} />
            <input type="hidden" name="status" value="rejected" />
            <Field label="Internal note (optional)" htmlFor="reject-note">
              <Textarea id="reject-note" name="note" rows={3} maxLength={1000} placeholder="Why, for anyone reviewing later" />
            </Field>
            <Result state={state} />
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

/** For an application under review, or (with tutorId) a tutor after approval (SPEC §4.4). */
export function RequestPoliceClearanceButton({
  applicationId,
  tutorId,
  again,
}: {
  applicationId?: string;
  tutorId?: string;
  again?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TutorApplicationState, FormData>(requestPoliceClearance, {});
  const formId = `clearance-${applicationId ?? tutorId ?? ""}`;
  return (
    <>
      <Button type="button" variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
        {again ? "Ask again" : "Request police clearance"}
      </Button>
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Request a police clearance certificate"
          description="They get a notification and an upload card. Admins are told when it arrives."
          footer={
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                {state.ok ? "Done" : "Cancel"}
              </Button>
              {state.ok ? null : (
                <Button type="submit" form={formId} disabled={pending}>
                  {pending ? "Sending…" : "Send request"}
                </Button>
              )}
            </div>
          }
        >
          <form id={formId} action={action} className="flex flex-col gap-3">
            {applicationId ? <input type="hidden" name="application_id" value={applicationId} /> : null}
            {tutorId ? <input type="hidden" name="tutor_id" value={tutorId} /> : null}
            <Field label="Message (optional)" htmlFor={`${formId}-note`}>
              <Textarea id={`${formId}-note`} name="note" rows={3} maxLength={500} placeholder="Please upload by 15 January." />
            </Field>
            <Result state={state} />
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

export function ApproveButton({
  applicationId,
  name,
  identityChecked,
  missingClearance,
}: {
  applicationId: string;
  name: string;
  identityChecked: boolean;
  /** Required for the round, or requested, and not uploaded. */
  missingClearance: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TutorApplicationState, FormData>(approveApplication, {});
  return (
    <>
      <Button type="button" className="w-fit" onClick={() => setOpen(true)}>
        Approve
      </Button>
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={`Approve ${name}?`}
          description="Their account becomes a tutor account. Subjects, documents and references are copied to their tutor record."
          footer={
            <form action={action} className="flex justify-end gap-3">
              <input type="hidden" name="application_id" value={applicationId} />
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Approving…" : "Approve"}
              </Button>
            </form>
          }
        >
          <div className="flex flex-col gap-3 text-[14px] leading-[1.5] text-ink">
            <p>
              They start as <strong>suspended</strong>: not in the public directory and not assignable to classes until you
              activate them on their tutor page, after setting pay and finishing vetting.
            </p>
            {!identityChecked ? (
              <FormMessage>Identity not checked yet. Compare the ID photo with the selfie first.</FormMessage>
            ) : null}
            {missingClearance ? (
              <FormMessage>No police clearance certificate yet. You can approve now and keep waiting for it.</FormMessage>
            ) : null}
            <Result state={state} />
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** Permanent: a confirm step, as with every destructive action. */
export function PurgeButton({ applicationId, name }: { applicationId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TutorApplicationState, FormData>(purgeApplication, {});
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return (
    <>
      <Button type="button" variant="danger" className="w-fit" onClick={() => setOpen(true)}>
        Delete
      </Button>
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={`Delete ${name}’s application?`}
          description="Their details, ID photo, selfie, CV, qualifications and references are deleted permanently. This cannot be undone."
          footer={
            <form action={action} className="flex justify-end gap-3">
              <input type="hidden" name="application_id" value={applicationId} />
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={pending}>
                {pending ? "Deleting…" : "Delete permanently"}
              </Button>
            </form>
          }
        >
          <div className="flex flex-col gap-3 text-[14px] leading-[1.5] text-ink">
            <p>
              The centre keeps unsuccessful applications for 12 months after the decision, as the privacy notice promises.
              Their account is not affected.
            </p>
            <Result state={state} />
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
