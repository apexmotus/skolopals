import type { Metadata } from "next";
import { PageHeading, StatCard } from "@/components/ui";
import { LessonTable } from "@/components/lesson-table";
import { createClient } from "@/lib/supabase/server";
import { effectiveStatus, listLessons } from "@/lib/lessons";
import { PAYOUT_SHARE, requireTutorListing } from "@/lib/tutor";
import { firstName, greeting, money } from "@/lib/format";

export const metadata: Metadata = { title: "Tutor dashboard" };

export default async function TutorDashboard() {
  const { profile, tutor } = await requireTutorListing();
  const lessons = await listLessons({ tutorId: tutor.id });
  const supabase = await createClient();

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisWeek = lessons.filter((l) => l.status === "confirmed" && new Date(l.starts_at) >= now && new Date(l.starts_at) < weekEnd);
  const students = new Set(lessons.filter((l) => l.status !== "cancelled").map((l) => l.student_id));

  const { data: payments } = await supabase
    .from("payments")
    .select("tutor_payout_cents, created_at, bookings!inner(tutor_id)")
    .eq("bookings.tutor_id", tutor.id)
    .eq("status", "paid")
    .gte("created_at", monthStart);
  const monthPayout = (payments ?? []).reduce((s, p) => s + (p.tutor_payout_cents ?? 0), 0);

  const upcoming = lessons
    .filter((l) => new Date(l.starts_at) >= now && ["pending", "confirmed"].includes(effectiveStatus(l)))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 3);

  return (
    <>
      <PageHeading title={`${greeting()}, ${firstName(profile.full_name)}`} description="Your teaching week at a glance." />
      <div className="flex flex-col gap-[14px] md:flex-row md:items-start">
        <StatCard label="Lessons this week" value={thisWeek.length} />
        <StatCard label="Students" value={students.size} />
        <StatCard label="Earnings this month" value={money(monthPayout)} hint={`Your ${PAYOUT_SHARE * 100}% share · paid weekly`} />
      </div>
      <LessonTable lessons={upcoming} perspective="tutor" empty="No upcoming lessons yet. Keep your availability up to date so students can book you." />
    </>
  );
}
