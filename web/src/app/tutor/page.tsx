import { Card, CardTitle, EmptyState, PageHeading, StatCard } from "@/components/ui";
import { getTutorContext, getMyClasses, getMyLearners, getMySessions, getSessionLoad } from "@/lib/tutor";
import { dateTime, firstName, greeting, nowMs } from "@/lib/format";

export default async function TutorOverview() {
  const { profile, tutor } = await getTutorContext();
  const today = new Date().toISOString().slice(0, 10);
  const inAWeek = new Date(nowMs() + 7 * 86_400_000).toISOString().slice(0, 10);

  const [classes, learners, sessions, load] = await Promise.all([
    getMyClasses(tutor.id),
    getMyLearners(tutor.id),
    getMySessions(tutor.id, today, inAWeek),
    getSessionLoad(tutor.id),
  ]);

  const thisMonth = load[0];

  return (
    <>
      <PageHeading
        title={`${greeting()}, ${firstName(profile.full_name)}`}
        description="Your classes, learners and sessions at the centre."
      />
      <div className="flex flex-col gap-4 md:flex-row">
        <StatCard label="Classes" value={String(classes.length)} />
        <StatCard label="Learners" value={String(learners.length)} />
        <StatCard
          label="Sessions this month"
          value={String(thisMonth?.sessions ?? 0)}
          hint={thisMonth ? `${thisMonth.hours} hours taught` : undefined}
        />
      </div>

      <Card>
        <CardTitle>Next seven days</CardTitle>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions scheduled" description="Sessions appear once the timetable is generated." />
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 text-[13px] text-black">
                <span>{s.class_groups?.name}</span>
                <span className="text-muted">{dateTime(s.starts_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
