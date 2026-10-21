import { PageHeading } from "@/components/ui";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Learners" };

export default function LearnersPage() {
  return (
    <>
      <PageHeading title="Learners" description="Every learner, their guardians, enrolment and placement." />
      <ComingSoon title="Not built yet" phase="Phase 4" description="The data model for this is complete and tested." />
    </>
  );
}
