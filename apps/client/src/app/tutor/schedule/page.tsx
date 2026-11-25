import { DataTable, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getTutorContext, getMySessions } from "@/lib/tutor";
import { getRooms, getSubjects } from "@/lib/queries";
import { SESSION_STATUS_LABEL, dateTime, labelFor, nowMs } from "@skolopals/shared/format";
import { SessionWhere } from "@/components/session-where";

export const metadata = { title: "My schedule" };

export default async function SchedulePage() {
  const { tutor } = await getTutorContext();
  const today = new Date().toISOString().slice(0, 10);
  const inAMonth = new Date(nowMs() + 31 * 86_400_000).toISOString().slice(0, 10);
  const [{ sessions, classById: classGroupById }, subjects, rooms] = await Promise.all([
    getMySessions(tutor.id, today, inAMonth),
    getSubjects(),
    getRooms(),
  ]);
  const subjectName = new Map(subjects.map((s) => [s.code, s.name]));
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));

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
              header: "Where",
              cell: (s) => {
                const classGroup = classGroupById.get(s.classGroupId);
                return (
                  <SessionWhere
                    mode={classGroup?.deliveryMode}
                    room={classGroup?.roomId ? roomName.get(classGroup.roomId) : undefined}
                    meetingUrl={s.meetingUrl}
                  />
                );
              },
            },
            { header: "Status", cell: (s) => labelFor(SESSION_STATUS_LABEL, s.status) },
          ]}
        />
      )}
    </>
  );
}
