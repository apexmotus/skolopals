import { Card, DataTable, EmptyState, PageHeading } from "@/components/ui";
import { getTutorContext, getSessionLoad, getMyPayRate } from "@/lib/tutor";
import { money } from "@/lib/format";

export const metadata = { title: "Sessions taught" };

const BASIS_LABEL: Record<string, string> = {
  monthly_salary: "Monthly salary",
  per_session: "Per session",
  per_hour: "Per hour",
};

export default async function SessionsPage() {
  const { tutor } = await getTutorContext();
  const [load, rate] = await Promise.all([getSessionLoad(tutor.id), getMyPayRate(tutor.id)]);

  return (
    <>
      <PageHeading title="Sessions taught" description="Your record of sessions and hours delivered at the centre." />

      <Card>
        <p className="text-[13px] text-black">
          {rate
            ? `You are paid by the centre: ${BASIS_LABEL[rate.pay_basis] ?? rate.pay_basis}, ${money(rate.amount_cents)}.`
            : "No pay rate is recorded yet. Ask the centre manager to set one."}
        </p>
        <p className="text-[12px] text-muted">
          Tutors are centre staff. Pay is not a share of what families are charged.
        </p>
      </Card>

      {load.length === 0 ? (
        <EmptyState title="No sessions recorded" description="This fills in as sessions are marked as held." />
      ) : (
        <DataTable
          rows={load}
          rowKey={(r) => String(r.month)}
          columns={[
            { header: "Month", cell: (r) => String(r.month).slice(0, 7), primary: true },
            { header: "Sessions", cell: (r) => String(r.sessions) },
            { header: "Hours", cell: (r) => String(r.hours) },
          ]}
        />
      )}
    </>
  );
}
