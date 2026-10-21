import { PageHeading } from "@/components/ui";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "My reports" };

export default function ProgressPage() {
  return (
    <>
      <PageHeading title="My reports" description="Your termly reports, once your tutor has published them." />
      <ComingSoon title="Not built yet" phase="Phase 5" description="The data model for this is complete and tested." />
    </>
  );
}
