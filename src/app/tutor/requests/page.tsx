import type { Metadata } from "next";
import { ButtonLink, Card, DetailRow, PageHeading } from "@/components/ui";
import { LessonTable } from "@/components/lesson-table";
import { listLessons } from "@/lib/lessons";
import { getOpenSlots } from "@/lib/queries";
import { requireTutorListing } from "@/lib/tutor";
import { dateTime, hourlyRate, isWithinLastDays } from "@/lib/format";

export const metadata: Metadata = { title: "Student requests" };

export default async function StudentRequestsPage() {
  const { tutor } = await requireTutorListing();
  const lessons = await listLessons({ tutorId: tutor.id, when: "upcoming" });
  const recent = lessons.filter((l) => isWithinLastDays(l.created_at, 14));

  if (recent.length === 0) {
    const [nextSlot] = await getOpenSlots(tutor.id, 1);
    return (
      <>
        <PageHeading title="Student requests" description="New bookings from students appear here." />
        <Card>
          <p className="text-[20px] font-bold text-ink">No new student requests</p>
          <p className="text-[13px] text-muted">When a student books one of your open times, you’ll see it here and in your schedule.</p>
          <div className="flex gap-3 rounded-[8px] bg-canvas p-[14px]">
            <span className="mt-1 size-[10px] shrink-0 rounded-full bg-brand" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-ink">Your profile is live</p>
              <p className="text-[13px] text-muted">Students can find you in search. More open times usually means more bookings.</p>
            </div>
          </div>
          <div className="flex flex-col gap-[10px]">
            <DetailRow label="Profile status" value="Live" />
            <DetailRow label="Next open slot" value={nextSlot ? dateTime(nextSlot.starts_at) : "None — add availability"} />
            <DetailRow label="Hourly rate" value={hourlyRate(tutor.hourly_rate_cents)} />
            <DetailRow label="Rating" value={`${Number(tutor.rating).toFixed(1)} from ${tutor.review_count} reviews`} />
          </div>
          <div className="flex flex-wrap gap-[10px]">
            <ButtonLink href="/tutor/schedule">Add availability</ButtonLink>
            <ButtonLink href={`/tutors/${tutor.slug}`} variant="secondary">
              View public profile
            </ButtonLink>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeading title="Student requests" description="Bookings made in the last two weeks." />
      <LessonTable lessons={recent} perspective="tutor" />
    </>
  );
}
