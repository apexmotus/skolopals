import { Badge, Card, CardTitle, DataTable, PageHeading, StatCard } from "@/components/ui";
import { InvoiceRunForm, LateFeeForm, PaymentForm } from "./billing-forms";
import { createClient } from "@/lib/supabase/server";
import { INVOICE_STATE_LABEL, money, shortDate } from "@/lib/format";

export const metadata = { title: "Billing" };

const TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  paid: "success",
  overdue: "danger",
  part_paid: "warning",
  unpaid: "neutral",
};

export default async function BillingPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date();
  nextMonth.setDate(1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const defaultPeriod = nextMonth.toISOString().slice(0, 7);

  const [{ data: invoices }, { data: accounts }, { data: outstanding }, { data: payments }] =
    await Promise.all([
      supabase.from("v_invoice_status").select("*").order("issued_on", { ascending: false }).limit(100),
      supabase.from("billing_accounts").select("id, guardians(profiles(full_name))").order("created_at"),
      supabase.from("v_outstanding_fees").select("*").order("outstanding_cents", { ascending: false }),
      supabase
        .from("payments")
        .select("*, billing_accounts(guardians(profiles(full_name)))")
        .order("paid_on", { ascending: false })
        .limit(25),
    ]);

  const rows = invoices ?? [];
  const totalOutstanding = (outstanding ?? []).reduce(
    (s, r) => s + Number(r.outstanding_cents ?? 0),
    0,
  );
  const collected = rows.reduce((s, r) => s + Number(r.settled_cents ?? 0), 0);

  return (
    <>
      <PageHeading
        title="Billing"
        description="Invoices are issued on the 15th for the month ahead and fall due on the 1st."
      />

      <div className="flex flex-col gap-4 md:flex-row">
        <StatCard label="Outstanding" value={money(totalOutstanding)} hint={`${(outstanding ?? []).length} account(s)`} />
        <StatCard label="Collected" value={money(collected)} />
        <StatCard label="Invoices" value={String(rows.length)} />
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="min-w-0 flex-1">
          <InvoiceRunForm defaultPeriod={defaultPeriod} />
        </div>
        <div className="min-w-0 flex-1">
          <LateFeeForm />
        </div>
      </div>

      <PaymentForm
        accounts={(accounts ?? []).map((a) => ({
          id: a.id,
          label: a.guardians?.profiles?.full_name ?? "Family",
        }))}
        today={today}
      />

      <Card>
        <CardTitle>Outstanding fees</CardTitle>
        <DataTable
          rows={outstanding ?? []}
          rowKey={(r) => String(r.billing_account_id)}
          empty="Every account is up to date."
          columns={[
            { header: "Family", cell: (r) => r.guardian_name ?? "", primary: true },
            { header: "Open invoices", cell: (r) => String(r.open_invoices ?? 0) },
            { header: "Outstanding", cell: (r) => money(Number(r.outstanding_cents ?? 0)) },
            { header: "Days overdue", cell: (r) => String(r.max_days_overdue ?? 0) },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>Invoices</CardTitle>
        <DataTable
          rows={rows}
          rowKey={(i) => i.id ?? i.invoice_number ?? ""}
          empty="No invoices raised yet."
          columns={[
            { header: "Number", cell: (i) => i.invoice_number ?? "", primary: true },
            { header: "Issued", cell: (i) => (i.issued_on ? shortDate(i.issued_on) : "") },
            { header: "Due", cell: (i) => (i.due_on ? shortDate(i.due_on) : "") },
            { header: "Total", cell: (i) => money(Number(i.total_cents ?? 0)) },
            { header: "Balance", cell: (i) => money(Number(i.balance_cents ?? 0)) },
            {
              header: "Status",
              cell: (i) => (
                <Badge tone={TONE[i.payment_state ?? ""] ?? "neutral"}>
                  {INVOICE_STATE_LABEL[i.payment_state as keyof typeof INVOICE_STATE_LABEL] ??
                    i.payment_state}
                </Badge>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>Recent payments</CardTitle>
        <DataTable
          rows={payments ?? []}
          rowKey={(p) => p.id}
          empty="No payments recorded yet."
          columns={[
            {
              header: "Family",
              cell: (p) => p.billing_accounts?.guardians?.profiles?.full_name ?? "",
              primary: true,
            },
            { header: "Date", cell: (p) => shortDate(p.paid_on) },
            { header: "Method", cell: (p) => p.method },
            { header: "Reference", cell: (p) => p.reference || "—" },
            { header: "Amount", cell: (p) => money(p.amount_cents) },
          ]}
        />
      </Card>
    </>
  );
}
