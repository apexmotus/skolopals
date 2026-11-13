import type { Metadata } from "next";
import { Card, EmptyState, PageHeading, Select } from "@skolopals/ui/ui";
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
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
      <PageHeading
        title="Our tutors"
        description="The people who teach at Skolopals. Fees are set by your package, not by the tutor."
      />

      <Card>
        <form className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-[6px] text-[12px] font-semibold text-ink">
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
          <label className="flex min-w-0 flex-1 flex-col gap-[6px] text-[12px] font-semibold text-ink">
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
          <label className="flex min-w-0 flex-1 flex-col gap-[6px] text-[12px] font-semibold text-ink">
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
          <button className="h-[42px] shrink-0 rounded-[8px] bg-brand px-[20px] text-[14px] font-semibold text-white transition-colors hover:bg-[#be166b]">
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
