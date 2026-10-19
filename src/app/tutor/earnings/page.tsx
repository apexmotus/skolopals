import type { Metadata } from "next";
import { DataTable, PageHeading, StatCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireTutorListing } from "@/lib/tutor";
import { money, nowMs, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const { tutor } = await requireTutorListing();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, bookings!inner(tutor_id, subject, starts_at)")
    .eq("bookings.tutor_id", tutor.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(100);
  const payments = data ?? [];

  const now = nowMs();
  const sum = (since: number) =>
    payments.filter((p) => new Date(p.created_at).getTime() >= since).reduce((s, p) => s + (p.tutor_payout_cents ?? 0), 0);
  const weekAgo = now - 7 * 86_400_000;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  // Payouts run weekly for completed lessons; anything not yet taught is pending.
  const pending = payments
    .filter((p) => new Date(p.bookings.starts_at).getTime() > now - 7 * 86_400_000)
    .reduce((s, p) => s + (p.tutor_payout_cents ?? 0), 0);

  return (
    <>
      <PageHeading title="Earnings" description="Your share of every lesson, paid weekly." />
      <div className="flex flex-col gap-[14px] md:flex-row md:items-start">
        <StatCard label="This week" value={money(sum(weekAgo))} />
        <StatCard label="This month" value={money(sum(monthStart))} />
        <StatCard label="Next payout" value={money(pending)} hint="Paid every Monday" />
      </div>
      <DataTable
        rows={payments}
        rowKey={(p) => p.id}
        empty="No paid lessons yet."
        columns={[
          { header: "Lesson", primary: true, cell: (p) => p.bookings.subject },
          { header: "Date", cell: (p) => shortDate(p.bookings.starts_at) },
          { header: "Lesson fee", cell: (p) => money(p.amount_cents) },
          { header: "Your payout (60%)", cell: (p) => money(p.tutor_payout_cents ?? 0) },
        ]}
      />
      <p className="text-[11px] text-muted">
        Students pay Skolopals directly. Skolopals retains 40% of each lesson fee; your 60% share is paid out weekly.
      </p>
    </>
  );
}
