import { Card, CardTitle, EmptyState, PageHeading, StatCard } from "@skolopals/ui/ui";
import { getTutorContext, getMyClasses, getMyLearners, getMySessions, getSessionLoad } from "@/lib/tutor";
import { dateTime, firstName, greeting, meetingPlatform, nowMs } from "@skolopals/shared/format";
import { createClient } from "@skolopals/shared/supabase/server";
import { PoliceClearanceRequestCard } from "@/app/(public)/teach/status-card";

export default async function TutorOverview() {
  const { profile, tutor } = await getTutorContext();
  const today = new Date().toISOString().slice(0, 10);
  const inAWeek = new Date(nowMs() + 7 * 86_400_000).toISOString().slice(0, 10);

  const supabase = await createClient();
  const [classes, learners, { sessions, classById }, load, { data: clearance }] = await Promise.all([
    getMyClasses(tutor.id),
    getMyLearners(),
    getMySessions(tutor.id, today, inAWeek),
    getSessionLoad(),
    // Set when the centre asks for a police clearance (SPEC-2026-11-tutor-applications.md §4.4).
    supabase
      .from("tutors")
      .select("police_clearance_requested_at, police_clearance_request_note")
      .eq("id", tutor.id)
      .maybeSingle(),
  ]);

  const thisMonth = load[0];

  return (
    <>
      <PageHeading
        title={`${greeting()}, ${firstName(profile.full_name)}`}
        description="Your classes, learners and sessions at the centre."
      />
      {clearance?.police_clearance_requested_at ? (
        <PoliceClearanceRequestCard note={clearance.police_clearance_request_note} />
      ) : null}
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
              <li key={s.id} className="flex flex-wrap justify-between gap-2 text-[13px] text-ink">
                <span>{classById.get(s.classGroupId)?.name}</span>
                <span className="flex gap-3">
                  {classById.get(s.classGroupId)?.deliveryMode !== "in_centre" && s.meetingUrl ? (
                    <a
                      href={s.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      Start on {meetingPlatform(s.meetingUrl)}
                    </a>
                  ) : null}
                  <span className="text-muted">{dateTime(s.startsAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
