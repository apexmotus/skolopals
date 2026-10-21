import { Card, CardTitle, DataTable, EmptyState, PageHeading } from "@/components/ui";
import { ClassForm, RegenerateButton, RoomForm, TermForm } from "./builder-forms";
import { createClient } from "@/lib/supabase/server";
import { getGrades, getLanguages, getSubjects } from "@/lib/queries";
import { getTutors } from "@/lib/admin";
import { clockTime, dayName, shortDate } from "@/lib/format";

export const metadata = { title: "Timetable" };

export default async function TimetableBuilderPage() {
  const supabase = await createClient();
  const [{ data: terms }, { data: rooms }, { data: classes }, subjects, languages, grades, tutors] =
    await Promise.all([
      supabase.from("terms").select("*").order("year", { ascending: false }).order("term_number"),
      supabase.from("rooms").select("*").eq("is_active", true).order("name"),
      supabase
        .from("class_groups")
        .select(
          "*, subjects(name), languages(name), rooms(name), terms(year, term_number), tutors(profiles(full_name)), class_group_grades(grade_code), class_schedules(day_of_week, starts_at_time, ends_at_time), class_sessions(id)",
        )
        .order("name"),
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
          languages={languages.map((l) => ({ code: l.code, name: l.name }))}
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

      <Card>
        <CardTitle>Classes this term</CardTitle>
        {(classes ?? []).length === 0 ? (
          <p className="text-[13px] text-muted">No classes yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {(classes ?? []).map((c) => (
              <div key={c.id} className="flex flex-col gap-2 border-t border-line pt-4 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[14px] font-bold text-ink">{c.name}</p>
                  <p className="text-[11px] text-muted">
                    {c.class_sessions?.length ?? 0} sessions · capacity {c.capacity}
                  </p>
                </div>
                <p className="text-[12px] text-muted">
                  {c.subjects?.name} in {c.languages?.name} ·{" "}
                  {(c.class_group_grades ?? [])
                    .map((g) => g.grade_code.replace("grade_", "Gr "))
                    .join(", ")}{" "}
                  · {c.tutors?.profiles?.full_name} ·{" "}
                  {c.delivery_mode === "online" ? "Online" : (c.rooms?.name ?? "—")}
                </p>
                <p className="text-[12px] text-black">
                  {(c.class_schedules ?? [])
                    .map(
                      (s) =>
                        `${dayName(s.day_of_week)} ${clockTime(s.starts_at_time)}–${clockTime(s.ends_at_time)}`,
                    )
                    .join(" · ") || "No weekly slots"}
                </p>
                <RegenerateButton classGroupId={c.id} />
              </div>
            ))}
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
