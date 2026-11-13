import { PageHeading } from "@skolopals/ui/ui";
import { ComingSoon } from "@skolopals/ui/coming-soon";

export const metadata = { title: "Learners" };

export default function LearnersPage() {
  return (
    <>
      <PageHeading title="Learners" description="Every learner, their guardians, enrolment and placement." />
      <ComingSoon title="Not built yet" phase="Phase 4" description="The data model for this is complete and tested." />
    </>
  );
}
