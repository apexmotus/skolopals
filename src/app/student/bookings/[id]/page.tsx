import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, CardTitle, FormMessage, PageHeading } from "@/components/ui";
import { effectiveStatus, getLesson } from "@/lib/lessons";
import { BOOKING_STATUS_LABEL, hoursUntil, longDate, money, time } from "@/lib/format";

export const metadata: Metadata = { title: "Booking details" };

const TONE = { pending: "warning", confirmed: "success", completed: "neutral", cancelled: "danger" } as const;

export default async function BookingDetailsPage({ params, searchParams }: PageProps<"/student/bookings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const lesson = await getLesson(id);
  if (!lesson) notFound();
  const status = effectiveStatus(lesson);
  const canChange = status === "confirmed" || status === "pending";
  const hoursLeft = hoursUntil(lesson.starts_at);

  return (
    <>
      <PageHeading title="Booking details" description={`${lesson.subject} with ${lesson.tutors?.full_name ?? "your tutor"}`} />
      {sp.cancelled ? (
        <FormMessage tone="success">Your lesson has been cancelled and a full refund is on its way to your card.</FormMessage>
      ) : null}
      {sp.error ? <FormMessage>We couldn’t cancel this lesson. Please contact support.</FormMessage> : null}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1">
          <CardTitle>{lesson.subject}</CardTitle>
          <Badge tone={TONE[status]}>{BOOKING_STATUS_LABEL[status]}</Badge>
          <div className="text-[13px] leading-[1.7] text-ink">
            <p>Tutor: {lesson.tutors?.full_name}</p>
            <p>
              {longDate(lesson.starts_at)} · {time(lesson.starts_at)}
            </p>
            <p>
              {lesson.duration_minutes} minutes · {lesson.format}
            </p>
            <p>Paid {money(lesson.price_cents)}</p>
            {lesson.learning_goal ? <p className="text-muted">Goal: {lesson.learning_goal}</p> : null}
          </div>
          {canChange ? (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/book/${lesson.tutors?.slug}`} variant="secondary">
                Reschedule
              </ButtonLink>
              <ButtonLink href={`/student/bookings/${lesson.id}/cancel`} variant="danger">
                Cancel lesson
              </ButtonLink>
            </div>
          ) : status === "completed" ? (
            <ButtonLink href={`/book/${lesson.tutors?.slug}`} className="w-fit">
              Book again
            </ButtonLink>
          ) : null}
        </Card>
        <Card className="w-full shrink-0 lg:w-[300px]">
          <CardTitle>Cancellation policy</CardTitle>
          <p className="text-[12px] text-muted">
            Free cancellation or rescheduling up to 24 hours before the lesson.
            {canChange && hoursLeft < 24 ? " This lesson starts within 24 hours — contact support to change it." : ""}
          </p>
        </Card>
      </div>
    </>
  );
}
