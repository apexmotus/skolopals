import Link from "next/link";
import { Badge, DataTable, EmptyState, PageHeading, StatCard } from "@/components/ui";
import { getAccount } from "@/lib/parent";
import { INVOICE_STATE_LABEL, money, shortDate } from "@/lib/format";

export const metadata = { title: "Fees & statement" };

const TONE: Record<string, "success" | "danger" | "neutral"> = {
  paid: "success",
  overdue: "danger",
  part_paid: "neutral",
  unpaid: "neutral",
};

export default async function AccountPage() {
  const { invoices, statement, outstanding } = await getAccount();

  return (
    <>
      <PageHeading
        title="Fees & statement"
        description="Invoices are issued on the 15th for the month ahead and fall due on the 1st."
      />
      <div className="flex flex-col gap-4 md:flex-row">
        <StatCard label="Outstanding" value={money(outstanding)} hint={outstanding > 0 ? "Please settle" : "Thank you"} />
        <StatCard label="Invoices" value={String(invoices.length)} />
      </div>

      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet" description="Your first invoice is issued when an enrolment is activated." />
      ) : (
        <DataTable
          rows={invoices}
          rowKey={(i) => i.id ?? i.invoice_number ?? ""}
          columns={[
            {
                  header: "Invoice",
                  primary: true,
                  cell: (i) => (
                    <Link href={`/parent/account/${i.id}`} className="text-brand hover:underline">
                      {i.invoice_number ?? ""}
                    </Link>
                  ),
                },
            { header: "Issued", cell: (i) => (i.issued_on ? shortDate(i.issued_on) : "") },
            { header: "Due", cell: (i) => (i.due_on ? shortDate(i.due_on) : "") },
            { header: "Total", cell: (i) => money(i.total_cents ?? 0) },
            { header: "Balance", cell: (i) => money(i.balance_cents ?? 0) },
            {
              header: "Status",
              cell: (i) => (
                <Badge tone={TONE[i.payment_state ?? ""] ?? "neutral"}>
                  {INVOICE_STATE_LABEL[i.payment_state as keyof typeof INVOICE_STATE_LABEL] ?? i.payment_state}
                </Badge>
              ),
            },
          ]}
        />
      )}

      {statement.length > 0 && (
        <>
          <h2 className="text-[20px] font-bold text-ink">Statement of account</h2>
          <DataTable
            rows={statement}
            rowKey={(s) => `${s.entry_type}-${s.reference}-${s.entry_date}-${s.debit_cents}-${s.credit_cents}`}
            columns={[
              { header: "Date", cell: (s) => (s.entry_date ? shortDate(s.entry_date) : "") },
              { header: "Type", cell: (s) => s.entry_type },
              { header: "Reference", cell: (s) => s.reference ?? "" },
              { header: "Debit", cell: (s) => (s.debit_cents ? money(s.debit_cents) : "") },
              { header: "Credit", cell: (s) => (s.credit_cents ? money(s.credit_cents) : "") },
            ]}
          />
        </>
      )}
    </>
  );
}
