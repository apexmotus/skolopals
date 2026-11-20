import { DataTable, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getUpcomingSessions } from "@/lib/parent";
import { DELIVERY_MODE_LABEL, dateTime } from "@skolopals/shared/format";

export const metadata = { title: "My timetable" };

export default async function TimetablePage() {
  // RLS limits sessions to the classes this learner is placed in.
  const sessions = await getUpcomingSessions(50);

  return (
    <>
      <PageHeading title="My timetable" description="Your upcoming classes, with where each one takes place." />
      {sessions.length === 0 ? (
        <EmptyState title="Nothing scheduled" description="Your classes will appear here once you are placed." />
      ) : (
        <DataTable
          rows={sessions}
          rowKey={(s) => s.id}
          columns={[
            { header: "Class", cell: (s) => s.class_groups?.name ?? "", primary: true },
            { header: "Subject", cell: (s) => s.class_groups?.subjects?.name ?? "" },
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
      )}
    </>
  );
}
