import { EmptyState, PageHeading } from "@/components/ui";
import { DataTable } from "@/components/ui";
import { getUpcomingSessions } from "@/lib/parent";
import { DELIVERY_MODE_LABEL, dateTime } from "@/lib/format";

export const metadata = { title: "Timetable" };

export default async function TimetablePage() {
  const sessions = await getUpcomingSessions(50);

  if (sessions.length === 0) {
    return (
      <>
        <PageHeading title="Timetable" description="Upcoming sessions for your learners." />
        <EmptyState title="Nothing scheduled" description="Sessions appear once a learner is placed in a class." />
      </>
    );
  }

  return (
    <>
      <PageHeading title="Timetable" description="Upcoming sessions for your learners." />
      <DataTable
        rows={sessions}
        rowKey={(s) => s.id}
        columns={[
          { header: "Class", cell: (s) => s.class_groups?.name ?? "" },
          { header: "When", cell: (s) => dateTime(s.starts_at) },
          {
            header: "Where",
            cell: (s) =>
              s.class_groups?.delivery_mode === "online"
                ? DELIVERY_MODE_LABEL.online
                : (s.class_groups?.rooms?.name ?? DELIVERY_MODE_LABEL.in_centre),
          },
        ]}
      />
    </>
  );
}
