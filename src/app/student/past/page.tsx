import type { Metadata } from "next";
import { PageHeading } from "@/components/ui";
import { LessonTable } from "@/components/lesson-table";
import { listLessons } from "@/lib/lessons";

export const metadata: Metadata = { title: "Past lessons" };

export default async function PastLessonsPage() {
  const lessons = await listLessons({ when: "past" });
  return (
    <>
      <PageHeading title="Past lessons" description="Completed and cancelled sessions." />
      <LessonTable lessons={lessons} perspective="student" linkBase="/student/bookings" empty="No past lessons yet." />
    </>
  );
}
