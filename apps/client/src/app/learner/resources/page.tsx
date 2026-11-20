import { PageHeading } from "@skolopals/ui/ui";
import { ResourceList } from "@/components/resource-list";

export const metadata = { title: "Resources" };

export default function ResourcesPage() {
  return (
    <>
      <PageHeading title="Resources" description="Worksheets and study material your tutor has shared with you." />
      <ResourceList />
    </>
  );
}
