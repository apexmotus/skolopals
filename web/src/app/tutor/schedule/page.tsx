import { DataTable, EmptyState, PageHeading } from "@/components/ui";
import { getTutorContext, getMySessions } from "@/lib/tutor";
import { dateTime, nowMs } from "@/lib/format";

export const metadata = { title: "My schedule" };

export default async function SchedulePage() {
  const { tutor } = await getTutorContext();
  const today = new Date().toISOString().slice(0, 10);
  const inAMonth = new Date(nowMs() + 31 * 86_400_000).toISOString().slice(0, 10);
  const sessions = await getMySessions(tutor.id, today, inAMonth);

  return (
    <>
      <PageHeading title="My schedule" description="Your sessions over the next month." />
      {sessions.length === 0 ? (
        <EmptyState title="Nothing scheduled" description="Sessions appear once an administrator generates the timetable." />
      ) : (
        <DataTable
          rows={sessions}
          rowKey={(s) => s.id}
          columns={[
            { header: "Class", cell: (s) => s.class_groups?.name ?? "", primary: true },
            { header: "Subject", cell: (s) => s.class_groups?.subjects?.name ?? "" },
            { header: "When", cell: (s) => dateTime(s.starts_at) },
            { header: "Room", cell: (s) => s.class_groups?.rooms?.name ?? "Online" },
            { header: "Status", cell: (s) => s.status },
          ]}
        />
      )}
    </>
  );
}
