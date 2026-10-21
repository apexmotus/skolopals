import type { Metadata } from "next";
import { Card, EmptyState, PageHeading, Select } from "@/components/ui";
import { TutorCard } from "@/components/tutor-card";
import { getGrades, getLanguages, getSubjects, searchTutors } from "@/lib/queries";

export const metadata: Metadata = { title: "Our tutors" };

export default async function TutorsPage({ searchParams }: PageProps<"/tutors">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const filters = {
    subject: one(sp.subject),
    grade: one(sp.grade),
    language: one(sp.language),
  };

  const [tutors, subjects, grades, languages] = await Promise.all([
    searchTutors(filters),
    getSubjects(),
    getGrades(),
    getLanguages(),
  ]);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading
        title="Our tutors"
        description="The people who teach at Skolopals. Fees are set by your package, not by the tutor."
      />

      <Card>
        <form className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-[6px] text-[11px] text-ink">
            Subject
            <Select name="subject" defaultValue={filters.subject ?? ""}>
              <option value="">Any subject</option>
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-[6px] text-[11px] text-ink">
            Grade
            <Select name="grade" defaultValue={filters.grade ?? ""}>
              <option value="">Any grade</option>
              {grades.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-[6px] text-[11px] text-ink">
            Language spoken
            <Select name="language" defaultValue={filters.language ?? ""}>
              <option value="">Any language</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </Select>
          </label>
          <button className="h-[38px] shrink-0 rounded-[6px] border border-line bg-brand px-[18px] text-[13px] text-white">
            Filter
          </button>
        </form>
      </Card>

      {tutors.length === 0 ? (
        <EmptyState title="No tutors match" description="Try a different subject or grade." />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {tutors.map((t) => (
            <TutorCard key={t.id} tutor={t} />
          ))}
        </div>
      )}
    </div>
  );
}
