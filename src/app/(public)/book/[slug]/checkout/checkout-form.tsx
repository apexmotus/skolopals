"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { Badge, Button, Card, CardTitle, DetailRow, Divider, Field, FormMessage, Input } from "@/components/ui";
import { initials, money, shortDate, time } from "@/lib/format";
import { payForLesson, type CheckoutState } from "../../actions";

export function CheckoutForm({
  slotId,
  duration,
  subject,
  goal,
  tutor,
  startsAt,
  priceCents,
  backHref,
  children,
}: {
  slotId: string;
  duration: number;
  subject: string;
  goal: string;
  tutor: { name: string; headline: string };
  startsAt: string;
  priceCents: number;
  backHref: string;
  children: ReactNode;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(payForLesson, {});
  // The full card number stays in the browser; only the last 4 digits are submitted.
  const [card, setCard] = useState("");
  const digits = card.replace(/\D/g, "");

  return (
    <form action={action} className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <input type="hidden" name="slot" value={slotId} />
      <input type="hidden" name="duration" value={duration} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="goal" value={goal} />
      <input type="hidden" name="card_last4" value={digits.slice(-4)} />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {state.declined ? (
          <div role="alert" className="flex flex-col gap-2 rounded-[10px] border border-danger bg-danger-soft p-5">
            <p className="text-[15px] font-bold text-danger">Payment declined</p>
            <p className="text-[13px] text-danger">
              Your card was declined and you haven’t been charged. Check the details, try another card, or contact your bank.
            </p>
          </div>
        ) : null}
        <Card>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Payment</CardTitle>
            <Badge tone="brand" className="bg-brand-tint py-[6px] font-semibold">
              <img src="/icons/lock.svg" alt="" width={14} height={14} />
              Secure checkout
            </Badge>
          </div>
          <Field label="Name on card" htmlFor="card_name">
            <Input id="card_name" name="card_name" autoComplete="cc-name" placeholder="Name as shown on card" required />
          </Field>
          <Field label="Card number" htmlFor="card_number">
            {/* No name attribute: this value is never submitted. */}
            <Input
              id="card_number"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="•••• •••• •••• 4242"
              value={card}
              onChange={(e) => setCard(e.target.value.replace(/[^\d ]/g, "").slice(0, 23))}
              aria-invalid={state.declined || undefined}
              className={state.declined ? "border-danger" : undefined}
              required
            />
          </Field>
          <div className="flex gap-3">
            <Field label="Expiry" htmlFor="card_exp" className="flex-1">
              <Input id="card_exp" autoComplete="cc-exp" placeholder="MM / YY" required />
            </Field>
            <Field label="CVC" htmlFor="card_cvc" className="flex-1">
              <Input id="card_cvc" autoComplete="cc-csc" inputMode="numeric" placeholder="123" maxLength={4} required />
            </Field>
          </div>
          <Field label="Billing address" htmlFor="billing">
            <Input id="billing" autoComplete="street-address" placeholder="Same as billing address" />
          </Field>
          <div className="flex items-center gap-2">
            <img src="/icons/shield-check.svg" alt="" width={14} height={14} />
            <p className="text-[11px] text-muted">Payment is securely collected by Skolopals.</p>
          </div>
        </Card>
        {children}
      </div>

      <Card className="w-full shrink-0 lg:w-[330px]">
        <CardTitle>Booking summary</CardTitle>
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-[24px] bg-brand-tint text-[14px] font-bold text-brand">
            {initials(tutor.name)}
          </span>
          <div className="flex min-w-0 flex-col gap-[2px]">
            <p className="text-[14px] font-bold text-ink">{tutor.name}</p>
            <p className="text-[12px] text-muted">{tutor.headline}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <DetailRow label="Date" value={shortDate(startsAt)} />
          <DetailRow label="Time" value={time(startsAt)} />
          <DetailRow label="Format" value="Online" />
          <DetailRow label="Duration" value={`${duration} minutes`} />
        </div>
        <Divider />
        <div className="flex flex-col gap-2 text-[13px]">
          <Row label="Lesson fee" value={money(priceCents)} />
          <Row label="Platform fee" value={money(0)} />
          <Row label="Taxes" value={money(0)} />
        </div>
        <Divider />
        <div className="flex items-center justify-between font-bold text-ink">
          <span className="text-[14px]">Total</span>
          <span className="text-[20px]">{money(priceCents)}</span>
        </div>
        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Processing…" : state.declined ? `Try again · ${money(priceCents)}` : `Pay ${money(priceCents)}`}
        </Button>
        <p className="text-[11px] text-muted">By confirming, you agree to the booking and cancellation policy.</p>
        <div className="flex items-center gap-2">
          <img src="/icons/help-circle.svg" alt="" width={14} height={14} />
          <p className="text-[11px] text-muted">
            Need help?{" "}
            <Link href="/contact" className="underline-offset-2 hover:underline">
              Contact support
            </Link>{" "}
            before you pay.
          </p>
        </div>
        <Link href={backHref} className="text-[11px] text-brand underline-offset-2 hover:underline">
          ← Change lesson details
        </Link>
      </Card>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
