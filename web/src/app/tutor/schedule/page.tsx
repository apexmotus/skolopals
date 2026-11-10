import { DataTable, EmptyState, PageHeading } from "@/components/ui";
import { getMyClasses, getTutorContext, getMySessions } from "@/lib/tutor";
import { getRooms, getSubjects } from "@/lib/queries";
import { dateTime, nowMs } from "@/lib/format";

export const metadata = { title: "My schedule" };

export default async function SchedulePage() {
  const { tutor } = await getTutorContext();
  const today = new Date().toISOString().slice(0, 10);
  const inAMonth = new Date(nowMs() + 31 * 86_400_000).toISOString().slice(0, 10);
  const [sessions, classes, subjects, rooms] = await Promise.all([
    getMySessions(today, inAMonth),
    getMyClasses(tutor.id),
    getSubjects(),
    getRooms(),
  ]);
  const subjectName = new Map(subjects.map((s) => [s.code, s.name]));
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const classGroupById = new Map(classes.map((c) => [c.id, c]));

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
            { header: "Class", cell: (s) => classGroupById.get(s.classGroupId)?.name ?? "", primary: true },
            {
              header: "Subject",
              cell: (s) => {
                const subjectCode = classGroupById.get(s.classGroupId)?.subjectCode;
                return (subjectCode && subjectName.get(subjectCode)) ?? "";
              },
            },
            { header: "When", cell: (s) => dateTime(s.startsAt) },
            {
              header: "Room",
              cell: (s) => {
                const roomId = classGroupById.get(s.classGroupId)?.roomId;
                return (roomId && roomName.get(roomId)) ?? "Online";
              },
            },
            { header: "Status", cell: (s) => s.status },
          ]}
        />
      )}
    </>
  );
}
