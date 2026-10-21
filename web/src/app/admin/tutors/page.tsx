import Link from "next/link";
import { Badge, DataTable, PageHeading } from "@/components/ui";
import { CreateTutorForm } from "./tutor-forms";
import { getTutors } from "@/lib/admin";

export const metadata = { title: "Tutors" };

export default async function AdminTutorsPage() {
  const tutors = await getTutors();

  return (
    <>
      <PageHeading
        title="Tutors"
        description="Centre staff. A tutor must have a competency before they can be given a class."
      />
      <CreateTutorForm />
      <DataTable
        rows={tutors}
        rowKey={(t) => t.id}
        empty="No tutors yet. Add the first one above."
        columns={[
          {
            header: "Name",
            primary: true,
            cell: (t) => (
              <Link href={`/admin/tutors/${t.id}`} className="text-brand hover:underline">
                {t.profiles?.full_name ?? t.slug}
              </Link>
            ),
          },
          { header: "Employment", cell: (t) => (t.employment_type === "salaried" ? "Salaried" : "Sessional") },
          {
            header: "Teaches",
            cell: (t) =>
              t.tutor_competencies?.length
                ? `${t.tutor_competencies.length} subject/grade pairs`
                : "Nothing yet — cannot be timetabled",
          },
          {
            header: "Status",
            cell: (t) => (
              <Badge tone={t.status === "active" ? "success" : t.status === "suspended" ? "danger" : "neutral"}>
                {t.status}
              </Badge>
            ),
          },
        ]}
      />
    </>
  );
}
