import Link from "next/link";
import { Button, Card, CardTitle, EmptyState, PageHeading, StatCard } from "@skolopals/ui/ui";
import { getSession } from "@skolopals/shared/auth";
import {
  getAccount,
  getApplications,
  getEnrolments,
  getLearners,
  getUnreadUpdates,
  getUpcomingSessions,
} from "@/lib/parent";
import { dateTime, firstName, greeting, money } from "@skolopals/shared/format";
import { ApplicationCard } from "@/components/applications/application-card";
import { markUpdatesRead } from "@/components/applications/actions";

export default async function ParentOverview() {
  const [session, learners, enrolments, upcoming, account, applications, updates] = await Promise.all([
    getSession(),
    getLearners(),
    getEnrolments(),
    getUpcomingSessions(5),
    getAccount(),
    getApplications(),
    getUnreadUpdates(),
  ]);

  const active = enrolments.filter((e) => e.status === "active");
  const currentYear = Number(new Date().toLocaleDateString("en-ZA", { year: "numeric", timeZone: "Africa/Johannesburg" }));

  return (
    <>
      <PageHeading
        title={`${greeting()}, ${firstName(session?.profile.full_name ?? "")}`}
        description="Your learners, their timetable and your account with the centre."
      />

      {applications.map((app) => (
        <ApplicationCard key={app.enrolment_id} app={app} currentYear={currentYear} />
      ))}

      {updates.length > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Updates from the centre</CardTitle>
            <form action={markUpdatesRead}>
              <Button type="submit" variant="secondary">
                Mark as read
              </Button>
            </form>
          </div>
          <ul className="flex flex-col gap-3">
            {updates.map((u) => (
              <li key={u.notification_id} className="flex flex-col gap-1 border-t border-line pt-3 first:border-t-0 first:pt-0">
                <span className="text-[13px] font-semibold text-ink">{u.notifications?.title}</span>
                <span className="whitespace-pre-line text-[13px] leading-[1.6] text-muted">{u.notifications?.body}</span>
                <span className="text-[12px] text-muted">{u.notifications ? dateTime(u.notifications.created_at) : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

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
              <li key={s.id} className="flex flex-wrap justify-between gap-2 text-[13px] text-ink">
                <span>{s.class_groups?.name}</span>
                <span className="text-muted">{dateTime(s.starts_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/parent/timetable" className="text-[12px] text-accent hover:underline">
          Full timetable
        </Link>
      </Card>

      {learners.length === 0 && (
        <Card>
          <CardTitle>Register your first learner</CardTitle>
          <p className="text-[13px] text-ink">
            Choose a package and send an application with your child’s latest school report. Your child then does a
            short aptitude test, and the centre reviews the application. You only pay once it is accepted.
          </p>
          <Link href="/enrol" className="text-[12px] text-accent hover:underline">
            Start enrolment
          </Link>
        </Card>
      )}
    </>
  );
}
