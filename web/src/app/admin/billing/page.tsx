import { PageHeading } from "@/components/ui";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <>
      <PageHeading title="Billing" description="Run the monthly invoice batch, record payments, apply late fees and issue statements." />
      <ComingSoon title="Not built yet" phase="Phase 6" description="The data model for this is complete and tested." />
    </>
  );
}
