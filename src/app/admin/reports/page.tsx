import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, PageHeading, StatCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const [{ data: payments }, { data: tutors }] = await Promise.all([
    supabase.from("payments").select("amount_cents, platform_fee_cents, tutor_payout_cents, status").limit(5000),
    supabase.from("tutors").select("id, full_name, rating, review_count, status").order("rating", { ascending: true }),
  ]);
  const paid = (payments ?? []).filter((p) => p.status === "paid");
  const gross = paid.reduce((s, p) => s + p.amount_cents, 0);
  const fees = paid.reduce((s, p) => s + (p.platform_fee_cents ?? 0), 0);
  const payouts = paid.reduce((s, p) => s + (p.tutor_payout_cents ?? 0), 0);
  const refunded = (payments ?? []).filter((p) => p.status === "refunded").length;

  return (
    <>
      <PageHeading title="Reports" description="Revenue split and rating monitoring." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
        <StatCard label="Gross bookings" value={money(gross)} />
        <StatCard label="Skolopals (40%)" value={money(fees)} />
        <StatCard label="Tutor payouts (60%)" value={money(payouts)} />
        <StatCard label="Refunded lessons" value={refunded} />
      </div>
      <DataTable
        rows={(tutors ?? []).filter((t) => t.status === "approved")}
        rowKey={(t) => t.id}
        columns={[
          {
            header: "Tutor",
            primary: true,
            cell: (t) => (
              <Link href={`/admin/tutors/${t.id}`} className="hover:text-brand hover:underline">
                {t.full_name}
              </Link>
            ),
          },
          { header: "Rating", cell: (t) => `★ ${Number(t.rating).toFixed(1)}` },
          { header: "Reviews", cell: (t) => t.review_count },
          { header: "Flag", cell: (t) => (Number(t.rating) < 4 && t.review_count >= 5 ? "Below 4.0 — review" : "OK") },
        ]}
      />
    </>
  );
}
