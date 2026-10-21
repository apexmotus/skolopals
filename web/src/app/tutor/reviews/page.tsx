import { PageHeading } from "@/components/ui";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return (
    <>
      <PageHeading title="Reviews" description="Reviews parents have left, once an administrator has published them." />
      <ComingSoon title="Not built yet" phase="Phase 6" description="The data model for this is complete and tested." />
    </>
  );
}
