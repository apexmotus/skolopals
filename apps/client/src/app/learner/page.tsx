import { Card, CardTitle, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getSession } from "@skolopals/shared/auth";
import { getUpcomingSessions } from "@/lib/parent";
import { dateTime, firstName, greeting } from "@skolopals/shared/format";

export default async function LearnerOverview() {
  const [session, upcoming] = await Promise.all([getSession(), getUpcomingSessions(5)]);

  return (
    <>
      <PageHeading
        title={`${greeting()}, ${firstName(session?.profile.full_name ?? "")}`}
        description="Your classes, your reports and your resources."
      />
      <Card>
        <CardTitle>Next classes</CardTitle>
        {upcoming.length === 0 ? (
          <EmptyState title="Nothing scheduled" description="Your classes will appear here once you are placed." />
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
      </Card>
    </>
  );
}
