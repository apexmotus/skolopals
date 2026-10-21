import { Card, CardTitle, DataTable, PageHeading, StatCard } from "@/components/ui";
import { getKpis } from "@/lib/admin";
import { money } from "@/lib/format";

export const metadata = { title: "KPIs" };

export default async function KpiPage() {
  const k = await getKpis();

  return (
    <>
      <PageHeading
        title="Key performance indicators"
        description="Financial, academic and business measures from the business plan, section 24."
      />

      {k.breakEven && (
        <div className="flex flex-col gap-4 md:flex-row">
          <StatCard
            label="Learners needed to break even"
            value={String(k.breakEven.learners_needed_to_break_even ?? "—")}
            hint={`Against ${money(Number(k.breakEven.expense_cents ?? 0))} of monthly cost`}
          />
          <StatCard label="Active learners" value={String(k.breakEven.active_learners ?? 0)} />
          <StatCard
            label="Average revenue per learner"
            value={money(Number(k.breakEven.avg_cents_per_learner ?? 0))}
          />
        </div>
      )}

      <Card>
        <CardTitle>Financial</CardTitle>
        <DataTable
          rows={k.surplus}
          rowKey={(r) => String(r.month)}
          empty="No invoices or expenses recorded yet."
          columns={[
            { header: "Month", cell: (r) => String(r.month).slice(0, 7), primary: true },
            { header: "Invoiced", cell: (r) => money(Number(r.invoiced_cents ?? 0)) },
            { header: "Collected", cell: (r) => money(Number(r.collected_cents ?? 0)) },
            { header: "Expenses", cell: (r) => money(Number(r.expense_cents ?? 0)) },
            { header: "Surplus", cell: (r) => money(Number(r.surplus_cents ?? 0)) },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>Attendance</CardTitle>
        <DataTable
          rows={k.attendance}
          rowKey={(r) => String(r.month)}
          empty="No registers marked yet."
          columns={[
            { header: "Month", cell: (r) => String(r.month).slice(0, 7), primary: true },
            { header: "Sessions", cell: (r) => String(r.sessions_recorded ?? 0) },
            { header: "Attended", cell: (r) => String(r.attended ?? 0) },
            { header: "Rate", cell: (r) => (r.attendance_rate_pct == null ? "—" : `${r.attendance_rate_pct}%`) },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>Retention</CardTitle>
        <DataTable
          rows={k.retention}
          rowKey={(r) => String(r.month)}
          empty="No learner history yet."
          columns={[
            { header: "Month", cell: (r) => String(r.month).slice(0, 7), primary: true },
            { header: "Active", cell: (r) => String(r.active_learners ?? 0) },
            { header: "New", cell: (r) => String(r.new_learners ?? 0) },
            { header: "Left", cell: (r) => String(r.departed_learners ?? 0) },
            { header: "Retention", cell: (r) => (r.retention_pct == null ? "—" : `${r.retention_pct}%`) },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>Enquiries</CardTitle>
        <DataTable
          rows={k.enquiries}
          rowKey={(r) => `${r.month}-${r.source}`}
          empty="No enquiries yet."
          columns={[
            { header: "Month", cell: (r) => String(r.month).slice(0, 7), primary: true },
            { header: "Source", cell: (r) => r.source ?? "" },
            { header: "Enquiries", cell: (r) => String(r.enquiries ?? 0) },
            { header: "Enrolled", cell: (r) => String(r.converted ?? 0) },
            { header: "Conversion", cell: (r) => (r.conversion_pct == null ? "—" : `${r.conversion_pct}%`) },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>Outstanding fees by family</CardTitle>
        <DataTable
          rows={k.outstanding}
          rowKey={(r) => String(r.billing_account_id)}
          empty="Every account is up to date."
          columns={[
            { header: "Guardian", cell: (r) => r.guardian_name ?? "", primary: true },
            { header: "Open invoices", cell: (r) => String(r.open_invoices ?? 0) },
            { header: "Outstanding", cell: (r) => money(Number(r.outstanding_cents ?? 0)) },
            { header: "Days overdue", cell: (r) => String(r.max_days_overdue ?? 0) },
          ]}
        />
      </Card>
    </>
  );
}
