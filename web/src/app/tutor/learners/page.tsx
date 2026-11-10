import { DataTable, EmptyState, PageHeading } from "@/components/ui";
import { getLearnerClassNames, getTutorContext, getMyLearners } from "@/lib/tutor";

export const metadata = { title: "My learners" };

export default async function TutorLearnersPage() {
  const { tutor } = await getTutorContext();
  const [learners, classNames] = await Promise.all([getMyLearners(), getLearnerClassNames(tutor.id)]);

  return (
    <>
      <PageHeading
        title="My learners"
        description="Learners currently placed in your classes. You see their academic record, not their family's billing or health information."
      />
      {learners.length === 0 ? (
        <EmptyState title="No learners yet" description="Learners appear once an administrator places them in your classes." />
      ) : (
        <DataTable
          rows={learners}
          rowKey={(l) => l.id}
          columns={[
            { header: "Learner", cell: (l) => l.fullName, primary: true },
            { header: "Grade", cell: (l) => l.gradeCode.replace("grade_", "Grade ").replace("Grade r", "Grade R") },
            { header: "Classes", cell: (l) => (classNames.get(l.id) ?? []).join(", ") },
          ]}
        />
      )}
    </>
  );
}
