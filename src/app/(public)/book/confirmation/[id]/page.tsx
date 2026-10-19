import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink, StatusState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { longDate, time } from "@/lib/format";

export const metadata: Metadata = { title: "Lesson booked" };

export default async function ConfirmationPage({ params }: PageProps<"/book/confirmation/[id]">) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("starts_at, status, tutors(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!booking || booking.status !== "confirmed") notFound();
  const tutorName = booking.tutors?.full_name ?? "your tutor";

  return (
    <div className="p-4 md:p-8">
      <StatusState
        icon="/icons/calendar-check.svg"
        title="Your lesson is booked"
        description={`${longDate(booking.starts_at)} at ${time(booking.starts_at)} with ${tutorName}. A receipt and calendar invite are on their way.`}
      >
        <ButtonLink href="/student">Go to student dashboard</ButtonLink>
      </StatusState>
    </div>
  );
}
