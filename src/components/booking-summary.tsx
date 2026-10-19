import type { ReactNode } from "react";
import { Card, CardTitle, Divider } from "@/components/ui";
import { money, shortDate, time } from "@/lib/format";

export function BookingSummary({
  tutorName,
  startsAt,
  minutes,
  priceCents,
  children,
}: {
  tutorName: string;
  startsAt: string | null;
  minutes: number;
  priceCents: number;
  children?: ReactNode;
}) {
  return (
    <Card className="w-full shrink-0 lg:w-[330px]">
      <CardTitle>Booking summary</CardTitle>
      <p className="text-[12px] font-bold text-black">{tutorName}</p>
      <div className="text-[12px] leading-[1.7] text-black">
        <p>{startsAt ? `${shortDate(startsAt)} · ${time(startsAt)}` : "Choose a time"}</p>
        <p>{minutes} minutes · Online</p>
        <p>Lesson fee {money(priceCents)}</p>
      </div>
      <Divider />
      <p className="text-[20px] text-black">Total {money(priceCents)}</p>
      {children}
    </Card>
  );
}
