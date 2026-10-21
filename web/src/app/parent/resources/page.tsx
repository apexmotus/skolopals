import { PageHeading } from "@/components/ui";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Resources" };

export default function ResourcesPage() {
  return (
    <>
      <PageHeading title="Resources" description="Worksheets and study material shared by your learner's tutor." />
      <ComingSoon title="Not built yet" phase="Phase 6" description="The data model for this is complete and tested." />
    </>
  );
}
