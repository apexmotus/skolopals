import { Badge, Card, CardTitle, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { createClient } from "@skolopals/shared/supabase/server";
import { longDate, nowMs, time, todayAtCentre } from "@skolopals/shared/format";
import { CancelSessionForm, ReinstateSessionForm, SubstituteForm } from "./session-forms";

export const metadata = { title: "Sessions" };

const DAYS_AHEAD = 21;

export default async function SessionsPage() {
  const supabase = await createClient();
  const today = todayAtCentre();
  const until = todayAtCentre(new Date(nowMs() + DAYS_AHEAD * 86_400_000));

  const [{ data: sessions }, { data: tutors }] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(
        "id, session_date, starts_at, ends_at, status, notes, tutor_id, class_groups(id, name, subject_code, language_code, tutor_id, class_group_grades(grade_code))",
      )
      .gte("session_date", today)
      .lte("session_date", until)
      .order("starts_at"),
    supabase
      .from("tutors")
      .select("id, profiles(full_name), tutor_competencies(subject_code, grade_code, tutor_competency_media(language_code))")
      .eq("status", "active"),
  ]);

  const tutorList = (tutors ?? []).map((t) => ({ ...t, name: t.profiles?.full_name ?? "Tutor" }));
  const tutorName = new Map(tutorList.map((t) => [t.id, t.name]));

  /** Tutors other than the class's own who teach its subject at every grade, in its language. */
  const coverFor = (cls: NonNullable<NonNullable<typeof sessions>[number]["class_groups"]>) => {
    const grades = (cls.class_group_grades ?? []).map((g) => g.grade_code);
    return tutorList
      .filter((t) => t.id !== cls.tutor_id)
      .filter((t) =>
        grades.every((grade) =>
          (t.tutor_competencies ?? []).some(
            (c) =>
              c.subject_code === cls.subject_code &&
              c.grade_code === grade &&
              (c.tutor_competency_media ?? []).some((m) => m.language_code === cls.language_code),
          ),
        ),
      )
      .map((t) => ({ id: t.id, name: t.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // One card per day.
  const days = new Map<string, NonNullable<typeof sessions>>();
  for (const s of sessions ?? []) days.set(s.session_date, [...(days.get(s.session_date) ?? []), s]);

  return (
    <>
      <PageHeading
        title="Sessions"
        description={`The next ${DAYS_AHEAD / 7} weeks, class by class. Cancel a session, or have another tutor cover it.`}
      />
      {days.size === 0 ? (
        <EmptyState title="No sessions coming up" description="Sessions appear once classes are created on the Timetable." />
      ) : (
        [...days].map(([date, daySessions]) => (
          <Card key={date}>
            <CardTitle>{longDate(daySessions[0]!.starts_at)}</CardTitle>
            <div className="flex flex-col divide-y divide-line">
              {daySessions.map((s) => {
                const cls = s.class_groups;
                if (!cls) return null;
                const cancelled = s.status === "cancelled";
                const teaching = s.tutor_id ? tutorName.get(s.tutor_id) : tutorName.get(cls.tutor_id);
                return (
                  <div key={s.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-ink">
                        {time(s.starts_at)}–{time(s.ends_at)} · {cls.name}
                      </span>
                      {cancelled ? (
                        <Badge tone="danger">Cancelled</Badge>
                      ) : s.tutor_id ? (
                        <Badge tone="warning">Covered by {teaching}</Badge>
                      ) : (
                        <Badge tone="neutral">{teaching}</Badge>
                      )}
                    </div>
                    {cancelled ? (
                      <>
                        {s.notes ? <p className="text-[12px] text-muted">Reason: {s.notes}</p> : null}
                        <ReinstateSessionForm sessionId={s.id} />
                      </>
                    ) : (
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-6">
                        <SubstituteForm sessionId={s.id} current={s.tutor_id} tutors={coverFor(cls)} />
                        <CancelSessionForm sessionId={s.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}
    </>
  );
}
