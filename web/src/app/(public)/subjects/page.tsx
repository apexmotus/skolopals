import type { Metadata } from "next";
import { Card, CardTitle, PageHeading } from "@/components/ui";
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
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading
        title="What we teach"
        description="Subjects follow the CAPS curriculum. Availability at each grade depends on tutor capacity."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {phases.map((p) => (
          <Card key={p.code}>
            <CardTitle>{p.name}</CardTitle>
            <p className="text-[11px] text-muted">{PHASE_GRADES[p.code] ?? ""}</p>
            <ul className="flex flex-col gap-1">
              {p.subjects.map((s) => (
                <li key={s} className="text-[13px] text-black">
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
