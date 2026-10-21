import { Badge, DataTable, EmptyState, PageHeading } from "@/components/ui";
import { getAttendance } from "@/lib/parent";
import { ATTENDANCE_LABEL, shortDate } from "@/lib/format";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const records = await getAttendance();

  if (records.length === 0) {
    return (
      <>
        <PageHeading title="Attendance" description="Every session your learners have attended." />
        <EmptyState title="No attendance yet" description="Registers appear here after the first session." />
      </>
    );
  }

  return (
    <>
      <PageHeading title="Attendance" description="Every session your learners have attended." />
      <DataTable
        rows={records}
        rowKey={(r) => r.id}
        columns={[
          { header: "Learner", cell: (r) => r.learners?.full_name ?? "" },
          { header: "Class", cell: (r) => r.class_sessions?.class_groups?.name ?? "" },
          { header: "Date", cell: (r) => (r.class_sessions ? shortDate(r.class_sessions.starts_at) : "") },
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
