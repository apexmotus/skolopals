import type { Metadata } from "next";
import { PageHeading } from "@/components/ui";
import { LessonTable } from "@/components/lesson-table";
import { listLessons } from "@/lib/lessons";
import { requireTutorListing } from "@/lib/tutor";

export const metadata: Metadata = { title: "Lesson history" };

export default async function LessonHistoryPage() {
  const { tutor } = await requireTutorListing();
  const lessons = await listLessons({ tutorId: tutor.id, when: "past" });
  return (
    <>
      <PageHeading title="Lesson history" />
      <LessonTable lessons={lessons} perspective="tutor" empty="No past lessons yet." />
    </>
  );
}
