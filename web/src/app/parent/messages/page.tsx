import { PageHeading } from "@/components/ui";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <>
      <PageHeading title="Messages" description="Message your learner's tutor or the centre manager about progress, absence or fees." />
      <ComingSoon title="Not built yet" phase="Phase 6" description="The data model for this is complete and tested." />
    </>
  );
}
