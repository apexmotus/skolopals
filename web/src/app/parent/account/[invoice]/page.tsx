import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, DataTable, DetailRow, PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { INVOICE_STATE_LABEL, money, shortDate } from "@/lib/format";

export const metadata = { title: "Invoice" };

/** An invoice with its lines and the payments against it — the receipt. */
export default async function InvoicePage({ params }: PageProps<"/parent/account/[invoice]">) {
  const { invoice: invoiceId } = await params;
  const supabase = await createClient();

  const [{ data: status }, { data: lines }, { data: allocations }] = await Promise.all([
    supabase.from("v_invoice_status").select("*").eq("id", invoiceId).maybeSingle(),
    supabase
      .from("invoice_lines")
      .select("*, learners(full_name)")
      .eq("invoice_id", invoiceId)
      .order("period_month", { nullsFirst: false }),
    supabase
      .from("payment_allocations")
      .select("amount_cents, payments(paid_on, method, reference)")
      .eq("invoice_id", invoiceId),
  ]);

  if (!status) notFound();

  return (
    <>
      <PageHeading
        title={status.invoice_number ?? "Invoice"}
        description="Skolopals Tutoring Centre · 10 Plumbago Street, Damonsville, Brits"
      />

      <Card>
        <CardTitle>Summary</CardTitle>
        <DetailRow label="Issued" value={status.issued_on ? shortDate(status.issued_on) : "—"} />
        <DetailRow label="Due" value={status.due_on ? shortDate(status.due_on) : "—"} />
        <DetailRow label="Total" value={money(Number(status.total_cents ?? 0))} />
        <DetailRow label="Paid" value={money(Number(status.settled_cents ?? 0))} />
        <DetailRow label="Balance" value={money(Number(status.balance_cents ?? 0))} />
        <DetailRow
          label="Status"
          value={
            <Badge tone={status.payment_state === "paid" ? "success" : "neutral"}>
              {INVOICE_STATE_LABEL[status.payment_state as keyof typeof INVOICE_STATE_LABEL] ??
                status.payment_state}
            </Badge>
          }
        />
      </Card>

      <Card>
        <CardTitle>What you are being charged for</CardTitle>
        <DataTable
          rows={lines ?? []}
          rowKey={(l) => l.id}
          columns={[
            { header: "Description", cell: (l) => l.description, primary: true },
            { header: "Learner", cell: (l) => l.learners?.full_name ?? "—" },
            { header: "Amount", cell: (l) => money(l.line_total_cents ?? 0) },
          ]}
        />
      </Card>

      {(allocations ?? []).length > 0 ? (
        <Card>
          <CardTitle>Payments received</CardTitle>
          <DataTable
            rows={allocations ?? []}
            rowKey={(a) => `${a.payments?.paid_on}-${a.amount_cents}`}
            columns={[
              { header: "Date", cell: (a) => (a.payments ? shortDate(a.payments.paid_on) : ""), primary: true },
              { header: "Method", cell: (a) => a.payments?.method ?? "" },
              { header: "Reference", cell: (a) => a.payments?.reference || "—" },
              { header: "Amount", cell: (a) => money(a.amount_cents) },
            ]}
          />
          <p className="text-[11px] text-muted">
            This serves as your receipt. Fees are paid by EFT or cash — we never take card details.
          </p>
        </Card>
      ) : null}
    </>
  );
}
