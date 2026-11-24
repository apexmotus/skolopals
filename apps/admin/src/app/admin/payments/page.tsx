import Link from "next/link";
import { Badge, DataTable, EmptyState, FormMessage, PageHeading } from "@skolopals/ui/ui";
import { getPaymentQueue } from "@/lib/admin";
import { dateTime, money } from "@skolopals/shared/format";

export const metadata = { title: "Payments" };

type Row = Awaited<ReturnType<typeof getPaymentQueue>>[number];

const DONE_MESSAGE: Record<string, string> = {
  activated: "Payment verified. The learner is enrolled and placed; the family has been told.",
  verified: "Payment verified and recorded.",
  rejected: "Proof rejected. The family has been told why and can upload a new one.",
};

/** PayShap proofs waiting to be checked, oldest first (SPEC §3.2). */
export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const [queue, { done }] = await Promise.all([getPaymentQueue(), searchParams]);
  const doneMessage = typeof done === "string" ? DONE_MESSAGE[done] : undefined;

  return (
    <>
      <PageHeading
        title="Payments"
        description="Proofs of payment to check, oldest first. A claimed amount that differs from the balance is flagged."
      />
      {doneMessage ? <FormMessage tone="success">{doneMessage}</FormMessage> : null}
      {queue.length === 0 ? (
        <EmptyState title="Nothing to check" description="Proofs of PayShap payments appear here when parents send them." />
      ) : (
        <DataTable<Row>
          rows={queue}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/payments/${r.id}`}
          columns={[
            {
              header: "Family",
              primary: true,
              cell: (r) => (
                <Link href={`/admin/payments/${r.id}`} className="font-semibold text-ink hover:text-accent hover:underline">
                  {r.family}
                </Link>
              ),
            },
            { header: "Learner(s)", cell: (r) => r.learners.join(", ") || "—" },
            { header: "Invoice", cell: (r) => `${r.invoiceNumber} · ${money(r.balanceCents)} due` },
            {
              header: "Claimed",
              cell: (r) =>
                r.claimedCents == null ? (
                  "—"
                ) : r.claimedCents !== r.balanceCents ? (
                  <Badge tone="warning">{money(r.claimedCents)}</Badge>
                ) : (
                  money(r.claimedCents)
                ),
            },
            { header: "Sent", cell: (r) => (r.submittedAt ? dateTime(r.submittedAt) : "—") },
          ]}
        />
      )}
    </>
  );
}
