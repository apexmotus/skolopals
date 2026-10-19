import type { Metadata } from "next";
import { ButtonLink, PageHeading } from "@/components/ui";
import { LessonTable } from "@/components/lesson-table";
import { listLessons } from "@/lib/lessons";

export const metadata: Metadata = { title: "Upcoming lessons" };

export default async function UpcomingLessonsPage() {
  const lessons = await listLessons({ when: "upcoming" });
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading title="Upcoming lessons" description="Your booked sessions. Select a lesson to reschedule or cancel." />
        <ButtonLink href="/tutors">Book a lesson</ButtonLink>
      </div>
      <LessonTable lessons={lessons} perspective="student" linkBase="/student/bookings" empty="No upcoming lessons. Book one to get started." />
    </>
  );
}
