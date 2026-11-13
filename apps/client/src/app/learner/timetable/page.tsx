import { PageHeading } from "@skolopals/ui/ui";
import { ComingSoon } from "@skolopals/ui/coming-soon";

export const metadata = { title: "My timetable" };

export default function TimetablePage() {
  return (
    <>
      <PageHeading title="My timetable" description="Your classes for the week, with the room or meeting link." />
      <ComingSoon title="Not built yet" phase="Phase 4" description="The data model for this is complete and tested." />
    </>
  );
}
