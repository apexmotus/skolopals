"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, DetailRow, Field, FormMessage, Input } from "@skolopals/ui/ui";
import { Dialog } from "@skolopals/ui/dialog";
import { Stepper } from "@skolopals/ui/stepper";
import { money, shortDate } from "@skolopals/shared/format";
import type { PaymentContext } from "@/lib/payments";
import { UploadField, type UploadedFile } from "@/components/uploads/upload-field";
import { startPayment, submitProof } from "./actions";

const STEPS = [
  { id: "review", label: "Review" },
  { id: "pay", label: "Pay" },
  { id: "proof", label: "Upload proof" },
  { id: "check", label: "Being checked" },
];

/** Where to open: derived from the latest submission, so closing the dialog never loses progress (§3.1). */
function stepFor(ctx: PaymentContext) {
  switch (ctx.submission?.status) {
    case "awaiting_proof":
    case "rejected":
      return 2;
    case "submitted":
      return 3;
    default:
      return 0;
  }
}

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
}

/**
 * PayShap payment in four steps, always showing "Step n of 4" (SPEC §3.1).
 * There is no gateway: the parent pays in their banking app, then uploads
 * proof, and the centre checks it.
 */
export function PayButton({
  ctx,
  label = "Pay with PayShap",
  deadline,
  className,
}: {
  ctx: PaymentContext;
  label?: string;
  /** "Please pay by Fri 28 Nov" for an offer (D14). */
  deadline?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? <PaymentDialog ctx={ctx} deadline={deadline} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PaymentDialog({ ctx, deadline, onClose }: { ctx: PaymentContext; deadline?: string | null; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(() => stepFor(ctx));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [proof, setProof] = useState<UploadedFile | null>(null);
  const [paidOn, setPaidOn] = useState(today());
  const [amount, setAmount] = useState((ctx.invoice.balanceCents / 100).toFixed(2));
  const [reference, setReference] = useState("");
  const rejected = ctx.submission?.status === "rejected" && step === 2;

  function markPaid() {
    setError(null);
    startTransition(async () => {
      const result = await startPayment(ctx.invoice.id);
      if (result.error) return setError(result.error);
      if (result.requoted) {
        // A new month: the old offer was cancelled and re-issued from today.
        setNotice("A new month has started, so we have updated the amount to cover the rest of this month. Please check it before paying.");
        setStep(0);
        router.refresh();
        return;
      }
      setStep(2);
      router.refresh();
    });
  }

  function sendProof() {
    setError(null);
    if (!proof) return setError("Upload a screenshot or PDF of the payment first.");
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return setError("Enter the amount you paid.");
    startTransition(async () => {
      // A rejected or missing submission needs a fresh one before proof can go on it.
      let submissionId = ctx.submission?.status === "awaiting_proof" ? ctx.submission.id : undefined;
      if (!submissionId) {
        const started = await startPayment(ctx.invoice.id);
        if (started.error || !started.submissionId) return setError(started.error ?? "Please try again.");
        submissionId = started.submissionId;
      }
      const result = await submitProof(submissionId, {
        path: proof.path,
        mimeType: proof.mimeType,
        claimedAmountCents: cents,
        claimedPaidOn: paidOn || undefined,
        payerReference: reference.trim() || undefined,
      });
      if (result.error) return setError(result.error);
      setStep(3);
      router.refresh();
    });
  }

  const footer =
    step === 0 ? (
      <Button type="button" onClick={() => setStep(1)} disabled={ctx.invoice.balanceCents <= 0}>
        Continue to payment
      </Button>
    ) : step === 1 ? (
      <>
        <Button type="button" variant="secondary" onClick={() => setStep(0)} disabled={pending}>
          Back
        </Button>
        <Button type="button" onClick={markPaid} disabled={pending || !ctx.settings}>
          {pending ? "Saving…" : "I have made the payment"}
        </Button>
      </>
    ) : step === 2 ? (
      <Button type="button" onClick={sendProof} disabled={pending || !proof}>
        {pending ? "Sending…" : rejected ? "Upload new proof" : "Submit proof"}
      </Button>
    ) : (
      <Button type="button" onClick={onClose}>
        Done
      </Button>
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title="Pay with PayShap"
      description={`Invoice ${ctx.invoice.number}`}
      header={<Stepper steps={STEPS} current={step} onSelect={(i) => i < step && step < 3 && setStep(i)} label="Payment steps" />}
      footer={<div className="flex flex-wrap justify-end gap-3">{footer}</div>}
    >
      <div className="flex flex-col gap-4 text-[14px] text-ink">
        {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}

        {step === 0 ? (
          <>
            {ctx.lines.map((l) => (
              <DetailRow key={l.id} label={l.description} value={money(l.amountCents)} />
            ))}
            <div className="border-t border-line pt-3">
              <DetailRow label="Total to pay" value={<span className="text-[16px]">{money(ctx.invoice.balanceCents)}</span>} />
            </div>
            {deadline ? (
              <p className="text-[13px] text-muted">
                Please pay by <span className="font-semibold text-ink">{shortDate(deadline)}</span> to keep the place.
              </p>
            ) : null}
            {ctx.invoice.balanceCents <= 0 ? <FormMessage tone="success">This invoice is paid. Thank you.</FormMessage> : null}
          </>
        ) : null}

        {step === 1 ? (
          ctx.settings ? (
            <>
              <p className="text-[13px] leading-[1.6] text-muted">
                Open your banking app → Pay → PayShap → enter the ShapID below. Use the invoice number as the reference so
                we can match your payment.
              </p>
              <CopyRow label="ShapID" value={ctx.settings.payshapId} large />
              <DetailRow label="Account name" value={ctx.settings.accountName} />
              {ctx.settings.bankName ? <DetailRow label="Bank" value={ctx.settings.bankName} /> : null}
              <CopyRow label="Amount" value={(ctx.invoice.balanceCents / 100).toFixed(2)} display={money(ctx.invoice.balanceCents)} />
              <CopyRow label="Reference" value={ctx.invoice.number} />
              {ctx.settings.instructions ? <p className="text-[13px] text-muted">{ctx.settings.instructions}</p> : null}
            </>
          ) : (
            <FormMessage>The centre has not set up its PayShap details yet. Please contact the centre to pay.</FormMessage>
          )
        ) : null}

        {step === 2 ? (
          <>
            {rejected ? (
              <FormMessage>
                We could not confirm your last payment: {ctx.submission?.rejectionReason}. Please check it and upload a new
                proof.
              </FormMessage>
            ) : (
              <p className="text-[13px] leading-[1.6] text-muted">
                Upload the payment confirmation from your banking app: a screenshot, photo or PDF.
              </p>
            )}
            <UploadField purpose="payment_proof" label="Proof of payment" value={proof} onChange={setProof} capture />
            <div className="flex flex-col gap-4 sm:flex-row">
              <Field label="Date paid" htmlFor="paid_on" className="flex-1">
                <Input id="paid_on" type="date" value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} />
              </Field>
              <Field label="Amount paid (R)" htmlFor="paid_amount" className="flex-1">
                <Input id="paid_amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
            </div>
            <Field label="Bank reference (optional)" htmlFor="payer_ref">
              <Input id="payer_ref" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="text-[15px] font-semibold">We’re checking your payment.</p>
            <p className="text-[13px] leading-[1.6] text-muted">
              We’ll let you know as soon as it’s confirmed. You can close this window.
            </p>
            {ctx.submission?.claimedAmountCents ? (
              <DetailRow label="Amount you paid" value={money(ctx.submission.claimedAmountCents)} />
            ) : null}
          </>
        ) : null}

        {error ? <FormMessage>{error}</FormMessage> : null}
      </div>
    </Dialog>
  );
}

function CopyRow({ label, value, display, large }: { label: string; value: string; display?: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-line px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-[12px] text-muted">{label}</span>
        <span className={large ? "text-[20px] font-bold tracking-wide" : "text-[15px] font-semibold"}>{display ?? value}</span>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
