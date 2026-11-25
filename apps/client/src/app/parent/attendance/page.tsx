import { Badge, DataTable, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getAttendance, getCheckIns } from "@/lib/parent";
import { ATTENDANCE_LABEL, shortDate, time } from "@skolopals/shared/format";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const records = await getAttendance();
  const checkIns = await getCheckIns([...new Set(records.map((r) => r.class_session_id))]);
  /** "In 14:02 · Out 15:07 · Collected by Lerato Mabaso", from the door, for classes at the centre. */
  const atTheDoor = (sessionId: string, learnerId: string) => {
    const c = checkIns.get(`${sessionId}|${learnerId}`);
    if (!c) return "—";
    const out = c.departed_at
      ? ` · Out ${time(c.departed_at)} · ${c.left_alone ? "Left on their own" : `Collected by ${c.collected_by_name ?? "—"}`}`
      : " · Still at the centre";
    return `In ${time(c.arrived_at)}${out}`;
  };

  if (records.length === 0) {
    return (
      <>
        <PageHeading title="Attendance" description="Each of your learners’ sessions, and whether they were present, late, absent or excused." />
        <EmptyState title="No attendance yet" description="Registers appear here after the first session." />
      </>
    );
  }

  return (
    <>
      <PageHeading title="Attendance" description="Each of your learners’ sessions, and whether they were present, late, absent or excused." />
      <DataTable
        rows={records}
        rowKey={(r) => r.id}
        columns={[
          { header: "Learner", cell: (r) => r.learners?.full_name ?? "" },
          { header: "Class", cell: (r) => r.class_sessions?.class_groups?.name ?? "" },
          { header: "Date", cell: (r) => (r.class_sessions ? shortDate(r.class_sessions.starts_at) : "") },
          { header: "At the centre", cell: (r) => atTheDoor(r.class_session_id, r.learner_id) },
          {
            header: "Status",
            cell: (r) => (
              <Badge tone={r.status === "present" ? "success" : r.status === "absent" ? "danger" : "neutral"}>
                {ATTENDANCE_LABEL[r.status as keyof typeof ATTENDANCE_LABEL] ?? r.status}
              </Badge>
            ),
          },
        ]}
      />
    </>
  );
}
