import { PageHeading } from "@/components/ui";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <>
      <PageHeading title="Expenses" description="Record operating expenses against the monthly budget so surplus is computed, not estimated." />
      <ComingSoon title="Not built yet" phase="Phase 6" description="The data model for this is complete and tested." />
    </>
  );
}
