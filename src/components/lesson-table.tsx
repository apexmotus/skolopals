import Link from "next/link";
import { DataTable } from "@/components/ui";
import { BOOKING_STATUS_LABEL, dateTime } from "@/lib/format";
import { effectiveStatus, type LessonRow } from "@/lib/lessons";

export function LessonTable({
  lessons,
  perspective,
  empty,
  linkBase,
}: {
  lessons: LessonRow[];
  perspective: "student" | "tutor";
  empty?: string;
  linkBase?: string;
}) {
  return (
    <DataTable
      rows={lessons}
      rowKey={(l) => l.id}
      empty={empty}
      columns={[
        {
          header: "Lesson",
          primary: true,
          cell: (l) =>
            linkBase ? (
              <Link href={`${linkBase}/${l.id}`} className="hover:text-brand hover:underline">
                {l.subject}
              </Link>
            ) : (
              l.subject
            ),
        },
        {
          header: perspective === "student" ? "Tutor" : "Student",
          cell: (l) => (perspective === "student" ? l.tutors?.full_name : l.profiles?.full_name) ?? "—",
        },
        { header: "Date", cell: (l) => dateTime(l.starts_at) },
        { header: "Status", cell: (l) => BOOKING_STATUS_LABEL[effectiveStatus(l)] },
      ]}
    />
  );
}
