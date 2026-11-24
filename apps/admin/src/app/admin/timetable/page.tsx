import { Card, CardTitle, DataTable, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { ClassForm, MeetingLinkForm, PlacementPanel, RegenerateButton, RoomForm, TermForm } from "./builder-forms";
import { createClient } from "@skolopals/shared/supabase/server";
import { getGrades, getLanguages, getSubjects } from "@skolopals/shared/reference";
import { getTutors } from "@/lib/admin";
import { clockTime, dayName, meetingPlatform, shortDate } from "@skolopals/shared/format";

/** The link on the class's latest linked session: what upcoming sessions use. */
function currentMeetingUrl(sessions: { session_date: string; meeting_url: string | null }[]) {
  return (
    sessions
      .filter((s) => s.meeting_url)
      .sort((a, b) => b.session_date.localeCompare(a.session_date))[0]?.meeting_url ?? null
  );
}

export const metadata = { title: "Timetable" };

export default async function TimetableBuilderPage() {
  const supabase = await createClient();
  const [{ data: terms }, { data: rooms }, { data: classes }, { data: activeEnrolments }, subjects, languages, grades, tutors] =
    await Promise.all([
      supabase.from("terms").select("*").order("year", { ascending: false }).order("term_number"),
      supabase.from("rooms").select("*").eq("is_active", true).order("name"),
      supabase
        .from("class_groups")
        .select(
          "*, subjects(name), languages(name), rooms(name), terms(year, term_number), tutors(profiles(full_name)), class_group_grades(grade_code), class_schedules(day_of_week, starts_at_time, ends_at_time), class_sessions(id, session_date, meeting_url), class_enrolments(id, left_on, learners(id, full_name, grade_code))",
        )
        .order("name"),
      // Only learners with an active (approved) enrolment can be placed.
      supabase
        .from("enrolments")
        .select("learners(id, full_name, grade_code)")
        .eq("status", "active"),
      getSubjects(),
      getLanguages(),
      getGrades(),
      getTutors(),
    ]);

  const termOptions = (terms ?? []).map((t) => ({
    id: t.id,
    label: `Term ${t.term_number} ${t.year} (${shortDate(t.starts_on)} – ${shortDate(t.ends_on)})`,
  }));
  const activeTutors = tutors
    .filter((t) => t.status === "active")
    .map((t) => ({ id: t.id, full_name: t.profiles?.full_name ?? t.slug }));

  const gradeName = new Map(grades.map((g) => [g.code, g.name]));
  const placeable = [
    ...new Map(
      (activeEnrolments ?? [])
        .flatMap((e) => (e.learners ? [e.learners] : []))
        .map((l) => [l.id, { id: l.id, name: l.full_name, gradeCode: l.grade_code, grade: gradeName.get(l.grade_code) ?? l.grade_code }]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const ready = termOptions.length > 0 && activeTutors.length > 0;

  return (
    <>
      <PageHeading
        title="Timetable"
        description="Terms, rooms and classes. Sessions are generated for the whole term when a class is created."
      />

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="min-w-0 flex-1">
          <TermForm />
        </div>
        <div className="min-w-0 flex-1">
          <RoomForm />
        </div>
      </div>

      {ready ? (
        <ClassForm
          subjects={subjects.map((s) => ({ code: s.code, name: s.name }))}
          languages={languages.filter((l) => l.isInstructionMedium).map((l) => ({ code: l.code, name: l.name }))}
          grades={grades.map((g) => ({ code: g.code, name: g.name }))}
          tutors={activeTutors}
          terms={termOptions}
          rooms={(rooms ?? []).map((r) => ({ id: r.id, name: r.name }))}
        />
      ) : (
        <EmptyState
          title="Add a term and a tutor first"
          description="A class needs a term to run in and a tutor to teach it."
        />
      )}

      <Card id="classes">
        <CardTitle>Classes this term</CardTitle>
        {(classes ?? []).length === 0 ? (
          <p className="text-[13px] text-muted">No classes yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {(classes ?? []).map((c) => {
              const meetingUrl = currentMeetingUrl(c.class_sessions ?? []);
              const online = meetingUrl ? `Online (${meetingPlatform(meetingUrl)})` : "Online, no link yet";
              const where =
                c.delivery_mode === "online"
                  ? online
                  : c.delivery_mode === "hybrid"
                    ? `${c.rooms?.name ?? "—"} + ${online}`
                    : (c.rooms?.name ?? "—");
              const placed = (c.class_enrolments ?? [])
                .filter((p) => p.left_on === null && p.learners)
                .map((p) => ({
                  placementId: p.id,
                  id: p.learners!.id,
                  name: p.learners!.full_name,
                  grade: gradeName.get(p.learners!.grade_code) ?? p.learners!.grade_code,
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
              const placedIds = new Set(placed.map((p) => p.id));
              return (
              <div key={c.id} id={`class-${c.id}`} className="flex flex-col gap-2 border-t border-line pt-4 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[14px] font-bold text-ink">{c.name}</p>
                  <p className="text-[11px] text-muted">
                    {c.class_sessions?.length ?? 0} sessions · {placed.length} of {c.capacity} places taken
                  </p>
                </div>
                <p className="text-[12px] text-muted">
                  {c.subjects?.name} in {c.languages?.name} ·{" "}
                  {(c.class_group_grades ?? [])
                    .map((g) => g.grade_code.replace("grade_", "Gr "))
                    .join(", ")}{" "}
                  · {c.tutors?.profiles?.full_name} · {where}
                </p>
                <p className="text-[12px] text-ink">
                  {(c.class_schedules ?? [])
                    .map(
                      (s) =>
                        `${dayName(s.day_of_week)} ${clockTime(s.starts_at_time)}–${clockTime(s.ends_at_time)}`,
                    )
                    .join(" · ") || "No weekly slots"}
                </p>
                <PlacementPanel
                  classGroupId={c.id}
                  capacity={c.capacity}
                  placed={placed}
                  candidates={placeable.filter((l) => !placedIds.has(l.id))}
                  classGrades={(c.class_group_grades ?? []).map((g) => g.grade_code)}
                />
                {c.delivery_mode !== "in_centre" ? (
                  <MeetingLinkForm classGroupId={c.id} currentUrl={meetingUrl} />
                ) : null}
                <RegenerateButton classGroupId={c.id} />
              </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Terms</CardTitle>
        <DataTable
          rows={terms ?? []}
          rowKey={(t) => t.id}
          empty="No terms entered yet."
          columns={[
            { header: "Term", cell: (t) => `Term ${t.term_number} ${t.year}`, primary: true },
            { header: "Starts", cell: (t) => shortDate(t.starts_on) },
            { header: "Ends", cell: (t) => shortDate(t.ends_on) },
          ]}
        />
      </Card>
    </>
  );
}
