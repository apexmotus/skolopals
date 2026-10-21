"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select } from "@/components/ui";
import { recordExpense, type ExpenseState } from "./actions";

export function ExpenseForm({
  categories,
  today,
}: {
  categories: { code: string; name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState<ExpenseState, FormData>(recordExpense, {});
  return (
    <Card>
      <CardTitle>Record an expense</CardTitle>
      <p className="text-[11px] text-muted">
        Recording expenses is what turns the business plan&rsquo;s illustrative surplus into a computed one.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Category" htmlFor="category_code">
            <Select id="category_code" name="category_code" required>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount in Rand" htmlFor="amount_rand">
            <Input id="amount_rand" name="amount_rand" inputMode="decimal" placeholder="5000" required />
          </Field>
          <Field label="Date" htmlFor="incurred_on">
            <Input id="incurred_on" name="incurred_on" type="date" defaultValue={today} />
          </Field>
        </div>
        <Field label="Description" htmlFor="description">
          <Input id="description" name="description" placeholder="What it was for" />
        </Field>
        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Saving…" : "Record expense"}
        </Button>
      </form>
    </Card>
  );
}
