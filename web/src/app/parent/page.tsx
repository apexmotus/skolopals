import Link from "next/link";
import { Card, CardTitle, EmptyState, PageHeading, StatCard } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getAccount, getEnrolments, getLearners, getUpcomingSessions } from "@/lib/parent";
import { dateTime, firstName, greeting, money } from "@/lib/format";

export default async function ParentOverview() {
  const [session, learners, enrolments, upcoming, account] = await Promise.all([
    getSession(),
    getLearners(),
    getEnrolments(),
    getUpcomingSessions(5),
    getAccount(),
  ]);

  const active = enrolments.filter((e) => e.status === "active");

  return (
    <>
      <PageHeading
        title={`${greeting()}, ${firstName(session?.profile.full_name ?? "")}`}
        description="Your learners, their timetable and your account with the centre."
      />

      <div className="flex flex-col gap-4 md:flex-row">
        <StatCard label="Learners" value={String(learners.length)} />
        <StatCard label="Active enrolments" value={String(active.length)} />
        <StatCard
          label="Account balance"
          value={money(account.outstanding)}
          hint={account.outstanding > 0 ? "Due now" : "Up to date"}
        />
      </div>

      <Card>
        <CardTitle>Next sessions</CardTitle>
        {upcoming.length === 0 ? (
          <EmptyState title="No sessions scheduled" description="Sessions appear here once a learner is placed in a class." />
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 text-[13px] text-black">
                <span>{s.class_groups?.name}</span>
                <span className="text-muted">{dateTime(s.starts_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/parent/timetable" className="text-[12px] text-brand hover:underline">
          Full timetable
        </Link>
      </Card>

      {learners.length === 0 && (
        <Card>
          <CardTitle>Register your first learner</CardTitle>
          <p className="text-[13px] text-black">
            Choose a package and register your child to get started. The centre will arrange an initial
            assessment and place them in a class.
          </p>
          <Link href="/enrol" className="text-[12px] text-brand hover:underline">
            Start enrolment
          </Link>
        </Card>
      )}
    </>
  );
}
