import type { Metadata } from "next";
import { ButtonLink, Card, CardTitle, DataTable, PageHeading } from "@skolopals/ui/ui";
import { getPackages } from "@/lib/queries";
import { money } from "@skolopals/shared/format";

export const metadata: Metadata = { title: "Fees" };

const PERIOD: Record<string, string> = {
  monthly: "per month",
  once_off: "once off",
  per_hour: "per hour",
  per_block: "per block of 4",
  per_programme: "per programme",
};

export default async function PricingPage() {
  const packages = await getPackages();
  const monthly = packages.filter((p) => p.billingPeriod === "monthly");
  const other = packages.filter((p) => p.billingPeriod !== "monthly");

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
      <PageHeading
        title="Our fees"
        description="Affordable small-group tutoring, with one-on-one support available. All fees in Rand."
      />

      <Card>
        <CardTitle>Monthly packages</CardTitle>
        <DataTable
          rows={monthly}
          rowKey={(p) => p.code}
          columns={[
            { header: "Package", cell: (p) => p.name, primary: true },
            { header: "Covers", cell: (p) => (p.subjectAllowance ? `${p.subjectAllowance} subject(s)` : "All subjects") },
            { header: "Fee", cell: (p) => (p.amountCents == null ? "—" : money(p.amountCents)) },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>Other services</CardTitle>
        <DataTable
          rows={other}
          rowKey={(p) => p.code}
          columns={[
            { header: "Service", cell: (p) => p.name, primary: true },
            { header: "Basis", cell: (p) => PERIOD[p.billingPeriod] ?? p.billingPeriod },
            {
              header: "Fee",
              cell: (p) =>
                p.amountCents == null
                  ? p.code === "holiday"
                    ? "R350 – R750"
                    : "—"
                  : money(p.amountCents),
            },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>How billing works</CardTitle>
        <p className="text-[14px] leading-[1.7] text-muted">
          A once-off registration fee is payable when your learner joins. Monthly invoices are issued on the
          15th for the month ahead and fall due on the 1st. A late payment fee applies after a three-day grace
          period. You can see every invoice, payment and your running balance in your parent portal.
        </p>
        <ButtonLink href="/enrol" className="w-fit">
          Enrol a learner
        </ButtonLink>
      </Card>
    </div>
  );
}
