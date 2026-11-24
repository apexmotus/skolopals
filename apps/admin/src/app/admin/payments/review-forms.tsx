"use client";

import { useActionState, useState } from "react";
import { Button, DetailRow, Field, FormMessage, Input } from "@skolopals/ui/ui";
import { Dialog } from "@skolopals/ui/dialog";
import { money } from "@skolopals/shared/format";
import { rejectPayment, verifyPayment, type ReviewState } from "./actions";

const REJECT_REASONS = [
  "Amount does not match",
  "Payment not received in the account",
  "Proof is unreadable",
  "Wrong reference",
];

export function VerifyForm({
  submissionId,
  claimedCents,
  claimedPaidOn,
  balanceCents,
  reference,
}: {
  submissionId: string;
  claimedCents: number | null;
  claimedPaidOn: string | null;
  balanceCents: number;
  reference: string;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(verifyPayment, {});
  const [confirming, setConfirming] = useState(false);
  const [amount, setAmount] = useState(((claimedCents ?? balanceCents) / 100).toFixed(2));
  const cents = Math.round(Number(amount.replace(",", ".")) * 100);

  return (
    <form id={`verify-${submissionId}`} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="submission_id" value={submissionId} />
      <div className="flex flex-col gap-4 sm:flex-row">
        <Field label="Amount received (R)" htmlFor="amount" className="flex-1">
          <Input id="amount" name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Date received" htmlFor="paid_on" className="flex-1">
          <Input id="paid_on" name="paid_on" type="date" defaultValue={claimedPaidOn ?? undefined} />
        </Field>
      </div>
      <Field label="Bank reference" htmlFor="reference">
        <Input id="reference" name="reference" defaultValue={reference} maxLength={100} />
      </Field>
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="button" className="w-fit" onClick={() => setConfirming(true)} disabled={pending || !(cents > 0)}>
        Verify payment
      </Button>
      {confirming ? (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          title="Verify this payment?"
          description="It is recorded as a PayShap payment. For a first invoice, the learner is enrolled and placed in classes straight away."
          footer={
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" form={`verify-${submissionId}`} disabled={pending}>
                {pending ? "Verifying…" : "Yes, verify"}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-2 text-[14px]">
            <DetailRow label="Amount received" value={Number.isFinite(cents) ? money(cents) : "—"} />
            <DetailRow label="Invoice balance" value={money(balanceCents)} />
            {cents < balanceCents ? (
              <FormMessage>This is less than the balance. The rest stays due and the learner is not enrolled yet.</FormMessage>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </form>
  );
}

export function RejectForm({ submissionId }: { submissionId: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(rejectPayment, {});
  const [reason, setReason] = useState("");
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="submission_id" value={submissionId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-[12px] font-semibold text-ink">Reason (the parent sees this)</legend>
        {[...REJECT_REASONS, "other"].map((r) => (
          <label key={r} className="flex items-center gap-2 text-[14px] text-ink">
            <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
            {r === "other" ? "Other" : r}
          </label>
        ))}
      </fieldset>
      {reason === "other" ? (
        <Field label="Describe the problem" htmlFor="reason_other">
          <Input id="reason_other" name="reason_other" maxLength={300} required />
        </Field>
      ) : null}
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" variant="secondary" className="w-fit" disabled={pending || !reason}>
        {pending ? "Rejecting…" : "Reject proof"}
      </Button>
    </form>
  );
}
