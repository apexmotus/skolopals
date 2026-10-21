"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select } from "@/components/ui";
import { applyLateFees, recordPayment, runInvoices, type BillingState } from "./actions";

function Result({ state }: { state: BillingState }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

export function InvoiceRunForm({ defaultPeriod }: { defaultPeriod: string }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(runInvoices, {});
  return (
    <Card>
      <CardTitle>Run the monthly invoices</CardTitle>
      <p className="text-[11px] text-muted">
        Bills every active enrolment for the month you choose, and catches up any earlier month that was
        never billed. Running it twice is safe — a month is never billed twice.
      </p>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <Field label="Month to bill" htmlFor="period">
          <Input id="period" name="period" type="month" defaultValue={defaultPeriod} required />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Running…" : "Run invoices"}
        </Button>
      </form>
      <Result state={state} />
    </Card>
  );
}

export function LateFeeForm() {
  const [state, action, pending] = useActionState<BillingState, FormData>(applyLateFees, {});
  return (
    <Card>
      <CardTitle>Apply late fees</CardTitle>
      <p className="text-[11px] text-muted">
        Charges the R150 fee on any invoice more than three days past due. The fee goes onto the next
        invoice, so an invoice already sent is never re-totalled.
      </p>
      <form action={action}>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Checking…" : "Apply late fees"}
        </Button>
      </form>
      <Result state={state} />
    </Card>
  );
}

export function PaymentForm({
  accounts,
  today,
}: {
  accounts: { id: string; label: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState<BillingState, FormData>(recordPayment, {});
  return (
    <Card>
      <CardTitle>Record a payment</CardTitle>
      <p className="text-[11px] text-muted">
        Allocated to the oldest unpaid invoice first. One payment can settle several invoices across a
        family&rsquo;s children.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <Field label="Family" htmlFor="billing_account_id">
          <Select id="billing_account_id" name="billing_account_id" required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Amount in Rand" htmlFor="amount_rand">
            <Input id="amount_rand" name="amount_rand" inputMode="decimal" placeholder="750" required />
          </Field>
          <Field label="Method" htmlFor="method">
            <Select id="method" name="method" defaultValue="eft">
              <option value="eft">EFT</option>
              <option value="cash">Cash</option>
              <option value="card_offline">Card (in person)</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Date" htmlFor="paid_on">
            <Input id="paid_on" name="paid_on" type="date" defaultValue={today} />
          </Field>
        </div>
        <Field label="Reference" htmlFor="reference">
          <Input id="reference" name="reference" placeholder="EFT reference or receipt number" />
        </Field>
        <Result state={state} />
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
      </form>
    </Card>
  );
}
