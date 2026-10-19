import type { Metadata } from "next";
import { Card, CardTitle, PageHeading, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireTutorListing } from "@/lib/tutor";
import { dayKey, dayLabel, time } from "@/lib/format";
import { removeSlot } from "../actions";
import { AddSlotForm } from "./add-slot-form";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const { tutor } = await requireTutorListing();
  const supabase = await createClient();
  const { data: slots } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("tutor_id", tutor.id)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(60);

  const byDay = new Map<string, NonNullable<typeof slots>>();
  for (const s of slots ?? []) {
    const k = dayKey(s.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const days = [...byDay.values()].slice(0, 5);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const activeWeekdays = new Set((slots ?? []).filter((s) => !s.is_booked).map((s) => dayLabel(s.starts_at).slice(0, 3)));

  return (
    <>
      <PageHeading title="Schedule" description="Booked lessons and open times students can book (UK time)." />
      <Card>
        <CardTitle>This week</CardTitle>
        {days.length === 0 ? (
          <p className="text-[12px] text-muted">No upcoming slots. Add some below so students can book you.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[560px] gap-[6px]" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d) => (
                <div key={d[0]!.id} className="flex flex-col gap-[6px]">
                  <p className="pb-2 text-center text-[11px] text-muted">{dayLabel(d[0]!.starts_at)}</p>
                  {d.map((s) => (
                    <form key={s.id} action={removeSlot} className="contents">
                      <input type="hidden" name="slot_id" value={s.id} />
                      <div
                        className={cx(
                          "group relative flex items-center justify-center rounded-[6px] border py-[10px] text-[11px] text-ink",
                          s.is_booked ? "border-brand bg-brand-soft" : "border-line bg-subtle",
                        )}
                      >
                        {time(s.starts_at)}
                        {s.is_booked ? (
                          <span className="sr-only"> booked</span>
                        ) : (
                          <button
                            aria-label={`Remove ${dayLabel(s.starts_at)} ${time(s.starts_at)}`}
                            className="absolute right-2 hidden text-muted hover:text-danger group-hover:block"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </form>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted">Highlighted times are booked. Hover an open time to remove it.</p>
      </Card>
      <Card>
        <CardTitle>Weekly availability</CardTitle>
        <div className="flex flex-wrap gap-[10px]">
          {weekdays.map((d) => (
            <span
              key={d}
              className={cx(
                "rounded-full px-[10px] py-[5px] text-[11px]",
                activeWeekdays.has(d) ? "bg-success-soft text-success" : "bg-[rgba(104,113,125,0.09)] text-muted",
              )}
            >
              {d} · {activeWeekdays.has(d) ? "Open" : "Off"}
            </span>
          ))}
        </div>
        <AddSlotForm />
      </Card>
    </>
  );
}
