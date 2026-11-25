import Link from "next/link";
import { Card, CardTitle, EmptyState, PageHeading, Select } from "@skolopals/ui/ui";
import { RegisterRow } from "./register-form";
import { getTutorContext } from "@/lib/tutor";
import { SessionWhere } from "@/components/session-where";
import { createClient } from "@skolopals/shared/supabase/server";
import { dateTime, nowMs, shortDate, todayAtCentre } from "@skolopals/shared/format";

export const metadata = { title: "Attendance register" };

export default async function RegisterPage({ searchParams }: PageProps<"/tutor/register">) {
  const sp = await searchParams;
  const chosen = Array.isArray(sp.session) ? sp.session[0] : sp.session;

  const { tutor } = await getTutorContext();
  const supabase = await createClient();

  // Today's sessions and the recent past, so a tutor can mark a register they missed.
  // Future sessions are left out: a register can't be marked before the day of the session.
  // Cancelled ones too, since nobody attended a class that didn't run.
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, session_date, starts_at, status, meeting_url, class_groups!inner(id, name, tutor_id, delivery_mode, rooms(name))")
    .eq("class_groups.tutor_id", tutor.id)
    .lte("session_date", todayAtCentre())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: false })
    .limit(30);

  const list = sessions ?? [];
  // Open the session that started most recently; if none of today's has started yet, the earliest of them.
  const current = list.find((s) => new Date(s.starts_at).getTime() <= nowMs()) ?? list[list.length - 1];
  const session = (chosen && list.find((s) => s.id === chosen)) || current;

  if (list.length === 0) {
    return (
      <>
        <PageHeading title="Attendance register" description="Mark who attended each session." />
        <EmptyState
          title="No sessions yet"
          description="Sessions appear once an administrator has built the timetable for your classes."
        />
      </>
    );
  }

  const [{ data: placed }, { data: marked }] = await Promise.all([
    supabase
      .from("class_enrolments")
      .select("learner_id, learners(full_name)")
      .eq("class_group_id", session?.class_groups?.id ?? "")
      .is("left_on", null),
    supabase
      .from("attendance_records")
      .select("learner_id, status")
      .eq("class_session_id", session?.id ?? ""),
  ]);

  const status = new Map((marked ?? []).map((m) => [m.learner_id, m.status]));
  const learners = (placed ?? [])
    .map((p) => ({ id: p.learner_id, name: p.learners?.full_name ?? "Learner" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeading
        title="Attendance register"
        description="Mark each learner present, late, absent or excused. Parents see this the same day."
      />

      <Card>
        <CardTitle>Choose a session</CardTitle>
        <form className="flex flex-wrap items-end gap-3">
          <Select name="session" defaultValue={session?.id} className="max-w-[420px]">
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.class_groups?.name} — {dateTime(s.starts_at)}
              </option>
            ))}
          </Select>
          <button className="h-[38px] rounded-[6px] border border-line bg-brand px-[18px] text-[13px] text-white">
            Open
          </button>
        </form>
      </Card>

      <Card>
        <CardTitle>
          {session?.class_groups?.name} · {session ? shortDate(session.starts_at) : ""}
        </CardTitle>
        <p className="text-[12px] text-muted">
          <SessionWhere
            mode={session?.class_groups?.delivery_mode}
            room={session?.class_groups?.rooms?.name}
            meetingUrl={session?.meeting_url}
          />
        </p>
        {learners.length === 0 ? (
          <p className="text-[13px] text-muted">
            No learners are placed in this class yet.{" "}
            <Link href="/tutor/learners" className="text-accent hover:underline">
              My learners
            </Link>
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted">
              {status.size} of {learners.length} marked.
            </p>
            <div className="flex flex-col">
              {learners.map((l) => (
                <RegisterRow
                  key={l.id}
                  sessionId={session!.id}
                  learnerId={l.id}
                  learnerName={l.name}
                  current={status.get(l.id) ?? null}
                />
              ))}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
