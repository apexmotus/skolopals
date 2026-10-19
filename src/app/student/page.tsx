import type { Metadata } from "next";
import { ButtonLink, Card, PageHeading, StatCard, cx } from "@/components/ui";
import { LessonTable } from "@/components/lesson-table";
import { requireRole } from "@/lib/auth";
import { effectiveStatus, listLessons } from "@/lib/lessons";
import { daysUntil, firstName, greeting, shortDate, time } from "@/lib/format";

export const metadata: Metadata = { title: "Student dashboard" };

export default async function StudentDashboard() {
  const profile = await requireRole("student");
  const lessons = await listLessons();
  const name = firstName(profile.full_name);

  if (lessons.length === 0) return <FirstTime name={name} />;

  const upcoming = lessons
    .filter((l) => ["pending", "confirmed"].includes(effectiveStatus(l)) && new Date(l.starts_at) > new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const completed = lessons.filter((l) => effectiveStatus(l) === "completed");
  const hours = completed.reduce((sum, l) => sum + l.duration_minutes, 0) / 60;
  const subjects = new Set(lessons.filter((l) => l.status !== "cancelled").map((l) => l.subject));
  const next = upcoming[0];
  const daysToNext = next ? daysUntil(next.starts_at) : null;

  const recent = [...upcoming.slice(0, 2), ...lessons.filter((l) => !upcoming.includes(l))].slice(0, 3);

  return (
    <>
      <PageHeading title={`${greeting()}, ${name}`} description="Here’s what’s happening with your learning." />
      <div className="flex flex-col gap-[14px] md:flex-row md:items-start">
        <StatCard label="Upcoming lessons" value={upcoming.length} hint={next ? `Next: ${shortDate(next.starts_at).slice(0, 3)} ${time(next.starts_at)}` : undefined} />
        <StatCard label="Hours learned" value={Number(hours.toFixed(1))} />
        <StatCard label="Current subjects" value={subjects.size} />
      </div>
      <LessonTable lessons={recent} perspective="student" linkBase="/student/bookings" />
      <div className="flex-1" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex max-w-[360px] flex-col gap-1">
          <p className="text-[13px] font-semibold text-ink">No upcoming actions</p>
          <p className="text-[12px] text-muted">
            {next
              ? `All lessons are confirmed and your next session starts ${daysToNext! <= 1 ? "within a day" : `in ${daysToNext} days`}.`
              : "You have no lessons booked. Find a tutor to keep your momentum going."}
          </p>
        </div>
        <div className="flex gap-[10px]">
          <ButtonLink href="/student/upcoming" variant="secondary" className="rounded-[8px] px-[14px] py-[10px] font-semibold">
            View all lessons
          </ButtonLink>
          <ButtonLink href="/tutors" variant="dark" className="rounded-[8px] px-[14px] py-[10px] font-semibold">
            Book a lesson
          </ButtonLink>
        </div>
      </div>
    </>
  );
}

function FirstTime({ name }: { name: string }) {
  const steps = [
    { label: "Create your Skolopals account", done: true },
    { label: "Find a tutor who matches your subject and level", done: false },
    { label: "Book your first lesson at a time that suits you", done: false },
    { label: "Message your tutor about your learning goals", done: false },
  ];
  return (
    <>
      <PageHeading title={`Welcome to Skolopals, ${name}`} description="Let’s get your first lesson booked." />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1">
          <p className="text-[20px] font-bold text-ink">Get started in four steps</p>
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3">
              <span
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  s.done ? "bg-brand text-white" : "border border-line bg-subtle text-muted",
                )}
              >
                {s.done ? <img src="/icons/check.svg" alt="" width={12} height={12} /> : i + 1}
              </span>
              <p className="flex-1 text-[13px] text-ink">{s.label}</p>
              <span className={cx("text-[12px]", s.done ? "text-brand" : "text-muted")}>{s.done ? "Done" : "To do"}</span>
            </div>
          ))}
          <ButtonLink href="/tutors" className="w-fit">
            Find a tutor
          </ButtonLink>
        </Card>
        <Card className="w-full shrink-0 lg:w-[300px]">
          <p className="text-[20px] font-bold text-ink">Not sure where to start?</p>
          <p className="text-[12px] leading-[1.6] text-muted">
            Tell us what you’re working towards and our team will suggest tutors who fit your goals and schedule.
          </p>
          <ButtonLink href="/contact" variant="secondary" className="w-fit">
            Get a recommendation
          </ButtonLink>
        </Card>
      </div>
    </>
  );
}
