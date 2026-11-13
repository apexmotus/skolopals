import type { Metadata } from "next";
import { Card, CardTitle, DataTable, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getOperatingHours, getPublicTimetable } from "@/lib/queries";
import { DELIVERY_MODE_LABEL, clockTime, dayName } from "@skolopals/shared/format";

export const metadata: Metadata = { title: "Timetable" };

export default async function TimetablePage() {
  const [hours, timetable] = await Promise.all([getOperatingHours(), getPublicTimetable()]);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
      <PageHeading title="When we are open" description="Centre hours and the current class timetable." />

      <Card>
        <CardTitle>Opening hours</CardTitle>
        <ul className="flex flex-col gap-1">
          {hours.map((h) => (
            <li key={`${h.dayOfWeek}-${h.opensAt}`} className="flex justify-between text-[13px]">
              <span className="text-muted">{dayName(h.dayOfWeek)}</span>
              <span className="text-ink">
                {clockTime(h.opensAt)} – {clockTime(h.closesAt)}
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
            rowKey={(t) => `${t.classGroupId}-${t.dayOfWeek}-${t.startsAtTime}`}
            columns={[
              { header: "Class", cell: (t) => t.className ?? "", primary: true },
              { header: "Day", cell: (t) => dayName(t.dayOfWeek) },
              { header: "Time", cell: (t) => `${clockTime(t.startsAtTime)} – ${clockTime(t.endsAtTime)}` },
              { header: "Language", cell: (t) => t.language ?? "" },
              {
                header: "Where",
                cell: (t) =>
                  DELIVERY_MODE_LABEL[t.deliveryMode as keyof typeof DELIVERY_MODE_LABEL] ?? t.deliveryMode,
              },
              { header: "Tutor", cell: (t) => t.tutorName ?? "" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
