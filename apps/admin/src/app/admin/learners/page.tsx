import { Badge, Card, CardTitle, DetailRow, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getLearners } from "@/lib/admin";
import { ENROLMENT_STATUS_LABEL, age, shortDate } from "@skolopals/shared/format";

export const metadata = { title: "Learners" };

const STATUS_TONE = { active: "success", prospective: "brand", paused: "warning", left: "neutral" } as const;

export default async function LearnersPage() {
  const learners = await getLearners();

  return (
    <>
      <PageHeading title="Learners" description="Every learner, their guardians, enrolment and placement." />
      {learners.length === 0 ? (
        <EmptyState title="No learners yet" description="Learners appear here once a parent submits an enrolment." />
      ) : (
        <div className="flex flex-col gap-4">
          {learners.map((l) => {
            const guardians = l.learner_guardians ?? [];
            const placements = (l.class_enrolments ?? []).filter((c) => c.left_on === null);
            return (
              <Card key={l.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{l.full_name}</CardTitle>
                  <Badge tone={STATUS_TONE[l.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                    {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                  </Badge>
                </div>
                <DetailRow label="Grade" value={l.grades?.name ?? l.grade_code} />
                <DetailRow label="Age" value={`${age(l.date_of_birth)} years`} />
                {l.school_name ? <DetailRow label="School" value={l.school_name} /> : null}
                <DetailRow label="Joined" value={shortDate(l.joined_on)} />
                <DetailRow
                  label="Guardians"
                  value={
                    guardians.length === 0
                      ? "None linked"
                      : guardians
                          .map(
                            (g) =>
                              `${g.guardians?.profiles?.full_name ?? "Guardian"} (${g.relationship}${g.is_primary ? ", primary" : ""})`,
                          )
                          .join(", ")
                  }
                />
                <DetailRow
                  label="Enrolment"
                  value={
                    (l.enrolments ?? [])
                      .map(
                        (e) =>
                          `${e.packages?.name ?? "Package"} · ${ENROLMENT_STATUS_LABEL[e.status as keyof typeof ENROLMENT_STATUS_LABEL] ?? e.status}`,
                      )
                      .join(", ") || "None"
                  }
                />
                <DetailRow
                  label="Classes"
                  value={placements.map((c) => c.class_groups?.name).filter(Boolean).join(", ") || "Not placed"}
                />
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
