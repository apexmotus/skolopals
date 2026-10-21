import type { Metadata } from "next";
import { Card, CardTitle, DataTable, EmptyState, PageHeading } from "@/components/ui";
import { getOperatingHours, getPublicTimetable } from "@/lib/queries";
import { DELIVERY_MODE_LABEL, clockTime, dayName } from "@/lib/format";

export const metadata: Metadata = { title: "Timetable" };

export default async function TimetablePage() {
  const [hours, timetable] = await Promise.all([getOperatingHours(), getPublicTimetable()]);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading title="When we are open" description="Centre hours and the current class timetable." />

      <Card>
        <CardTitle>Opening hours</CardTitle>
        <ul className="flex flex-col gap-1">
          {hours.map((h) => (
            <li key={`${h.day_of_week}-${h.opens_at}`} className="flex justify-between text-[13px]">
              <span className="text-muted">{dayName(h.day_of_week)}</span>
              <span className="text-ink">
                {clockTime(h.opens_at)} – {clockTime(h.closes_at)}
                {h.purpose === "administration" ? " · tests, catch-up and parent meetings" : ""}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Classes</CardTitle>
        {timetable.length === 0 ? (
          <EmptyState title="Timetable not published yet" description="Class times appear here once the term is set up." />
        ) : (
          <DataTable
            rows={timetable}
            rowKey={(t) => `${t.class_group_id}-${t.day_of_week}-${t.starts_at_time}`}
            columns={[
              { header: "Class", cell: (t) => t.class_name ?? "", primary: true },
              { header: "Day", cell: (t) => dayName(Number(t.day_of_week ?? 0)) },
              { header: "Time", cell: (t) => `${clockTime(t.starts_at_time ?? "")} – ${clockTime(t.ends_at_time ?? "")}` },
              { header: "Language", cell: (t) => t.language ?? "" },
              {
                header: "Where",
                cell: (t) =>
                  DELIVERY_MODE_LABEL[t.delivery_mode as keyof typeof DELIVERY_MODE_LABEL] ?? t.delivery_mode,
              },
              { header: "Tutor", cell: (t) => t.tutor_name ?? "" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
