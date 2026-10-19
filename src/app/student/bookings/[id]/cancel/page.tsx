import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Button, ButtonLink, Card, CardTitle, DetailRow, PageHeading } from "@/components/ui";
import { effectiveStatus, getLesson } from "@/lib/lessons";
import { longDate, money, time } from "@/lib/format";
import { cancelLesson } from "../../../actions";

export const metadata: Metadata = { title: "Cancel lesson" };

export default async function CancelLessonPage({ params }: PageProps<"/student/bookings/[id]/cancel">) {
  const { id } = await params;
  const lesson = await getLesson(id);
  if (!lesson) notFound();
  const status = effectiveStatus(lesson);
  if (status !== "confirmed" && status !== "pending") redirect(`/student/bookings/${id}`);

  return (
    <>
      <PageHeading title="Cancel this lesson?" description="Check the details below before you confirm." />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 rounded-[8px] bg-warning-soft p-[14px]">
            <span className="size-[10px] rounded-full bg-warning" />
            <p className="text-[13px] font-semibold text-ink">You’ll receive a full refund</p>
            <p className="text-[13px] text-muted">Cancelling more than 24 hours before the lesson is free. Your tutor will be notified.</p>
          </div>
          <CardTitle>{lesson.subject}</CardTitle>
          <div className="flex flex-col gap-[10px]">
            <DetailRow label="Tutor" value={lesson.tutors?.full_name} />
            <DetailRow label="Date and time" value={`${longDate(lesson.starts_at)}, ${time(lesson.starts_at)}`} />
            <DetailRow label="Duration" value={`${lesson.duration_minutes} minutes`} />
          </div>
          <p className="text-[13px] text-muted">The time slot will be released so other students can book it.</p>
          <form action={cancelLesson} className="flex flex-col gap-[10px]">
            <input type="hidden" name="booking_id" value={lesson.id} />
            <Button variant="danger" className="w-full">
              Yes, cancel lesson
            </Button>
            <ButtonLink href={`/student/bookings/${lesson.id}`} variant="secondary" className="w-full">
              Keep my lesson
            </ButtonLink>
          </form>
        </Card>
        <Card className="w-full shrink-0 lg:w-[300px]">
          <CardTitle>Refund summary</CardTitle>
          <div className="flex flex-col gap-[10px]">
            <DetailRow label="Paid" value={money(lesson.price_cents)} />
            <DetailRow label="Fee" value={money(0)} />
            <DetailRow label="Refund" value={money(lesson.price_cents)} />
            <DetailRow label="To" value="Original card" />
          </div>
        </Card>
      </div>
    </>
  );
}
