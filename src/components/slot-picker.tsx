import Link from "next/link";
import { cx } from "@/components/ui";
import { dayKey, dayLabel, time } from "@/lib/format";
import type { AvailabilitySlot } from "@/lib/database.types";

/**
 * Week view of open slots, one column per day (as in the Figma calendar).
 * Each slot links to `hrefFor(slot)`; `selectedId` is highlighted.
 */
export function SlotPicker({
  slots,
  selectedId,
  hrefFor,
  days = 5,
  maxPerDay,
}: {
  slots: AvailabilitySlot[];
  selectedId?: string;
  hrefFor?: (slot: AvailabilitySlot) => string;
  days?: number;
  maxPerDay?: number;
}) {
  const byDay = new Map<string, AvailabilitySlot[]>();
  for (const s of slots) {
    const k = dayKey(s.starts_at);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(s);
  }
  const columns = [...byDay.values()].slice(0, days);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[480px] gap-[6px]" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((daySlots) => (
          <div key={daySlots[0]!.id} className="flex flex-col gap-[6px]">
            <p className="pb-[8px] text-center text-[11px] text-muted">{dayLabel(daySlots[0]!.starts_at)}</p>
            {daySlots.slice(0, maxPerDay).map((slot) => {
              const selected = slot.id === selectedId;
              const className = cx(
                "flex items-center justify-center rounded-[6px] border py-[10px] text-[11px] text-ink",
                selected ? "border-brand bg-brand-soft" : "border-line bg-subtle",
                hrefFor && !selected && "hover:border-brand",
              );
              return hrefFor ? (
                <Link key={slot.id} href={hrefFor(slot)} aria-current={selected || undefined} className={className} scroll={false}>
                  {time(slot.starts_at)}
                </Link>
              ) : (
                <span key={slot.id} className={className}>
                  {time(slot.starts_at)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
