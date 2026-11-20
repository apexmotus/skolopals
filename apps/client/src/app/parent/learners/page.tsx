import { ButtonLink, Card, CardTitle, DetailRow, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getLearners } from "@/lib/parent";
import { age } from "@skolopals/shared/format";

export const metadata = { title: "My learners" };

export default async function LearnersPage() {
  const learners = await getLearners();

  return (
    <>
      <PageHeading title="My learners" description="The children registered under your account." />
      {learners.length === 0 ? (
        <EmptyState title="No learners yet" description="Register a learner from the enrolment page." />
      ) : (
        <div className="flex flex-col gap-4">
          {learners.map((l) => (
            <Card key={l.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{l.full_name}</CardTitle>
                <ButtonLink href={`/parent/learners/${l.id}`} variant="secondary">
                  Edit details
                </ButtonLink>
              </div>
              <DetailRow label="Grade" value={l.grades?.name ?? l.grade_code} />
              <DetailRow label="Age" value={`${age(l.date_of_birth)} years`} />
              <DetailRow label="School" value={l.school_name || "Not recorded"} />
              <DetailRow label="Status" value={l.status[0].toUpperCase() + l.status.slice(1)} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
