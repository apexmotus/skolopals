import Link from "next/link";
import { Card, CardTitle, PageHeading, StatCard } from "@/components/ui";
import { getDashboard } from "@/lib/admin";
import { money } from "@/lib/format";

export default async function AdminDashboard() {
  const d = await getDashboard();

  return (
    <>
      <PageHeading title="Centre dashboard" description="Skolopals Tutoring Centre, Damonsville." />

      <div className="flex flex-col gap-4 md:flex-row">
        <StatCard label="Active learners" value={String(d.activeLearners)} hint="Target: 30–50 in year one" />
        <StatCard label="Active tutors" value={String(d.activeTutors)} />
        <StatCard
          label="Awaiting approval"
          value={String(d.pendingEnrolments)}
          hint={d.pendingEnrolments > 0 ? "Enrolments to review" : undefined}
        />
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <StatCard
          label="Collected this month"
          value={money(Number(d.surplus?.collected_cents ?? 0))}
        />
        <StatCard label="Expenses this month" value={money(Number(d.surplus?.expense_cents ?? 0))} />
        <StatCard
          label="Operating surplus"
          value={money(Number(d.surplus?.surplus_cents ?? 0))}
          hint="On cash collected, not invoiced"
        />
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <Card className="flex-1">
          <CardTitle>Outstanding fees</CardTitle>
          <p className="text-[28px] text-ink">{money(d.outstandingCents)}</p>
          <Link href="/admin/billing" className="text-[12px] text-brand hover:underline">
            Go to billing
          </Link>
        </Card>
        <Card className="flex-1">
          <CardTitle>New enquiries</CardTitle>
          <p className="text-[28px] text-ink">{d.newEnquiries}</p>
          <Link href="/admin/enquiries" className="text-[12px] text-brand hover:underline">
            Review enquiries
          </Link>
        </Card>
      </div>
    </>
  );
}
