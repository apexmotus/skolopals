import type { Metadata } from "next";
import { Card, CardTitle, PageHeading } from "@skolopals/ui/ui";
import { getSubjectsByPhase } from "@/lib/queries";

export const metadata: Metadata = { title: "Subjects" };

const PHASE_GRADES: Record<string, string> = {
  foundation: "Grade R – 3",
  intermediate: "Grade 4 – 6",
  senior: "Grade 7 – 9",
  fet: "Grade 10 – 12",
};

export default async function SubjectsPage() {
  const phases = await getSubjectsByPhase();

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
      <PageHeading
        title="What we teach"
        description="Subjects follow the CAPS curriculum. Availability at each grade depends on tutor capacity."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {phases.map((p) => (
          <Card key={p.code}>
            <CardTitle>{p.name}</CardTitle>
            <p className="text-[12px] font-medium text-muted">{PHASE_GRADES[p.code] ?? ""}</p>
            <ul className="flex flex-col gap-1">
              {p.subjects.map((s) => (
                <li key={s} className="text-[14px] text-muted">
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
