import { PageHeading } from "@skolopals/ui/ui";
import { ComingSoon } from "@skolopals/ui/coming-soon";

export const metadata = { title: "Resources" };

export default function ResourcesPage() {
  return (
    <>
      <PageHeading title="Resources" description="Worksheets and study material your tutor has shared with you." />
      <ComingSoon title="Not built yet" phase="Phase 6" description="The data model for this is complete and tested." />
    </>
  );
}
