import Link from "next/link";
import { DataTable, EmptyState, FormMessage, PageHeading } from "@skolopals/ui/ui";
import { getEnrolmentQueue } from "@/lib/admin";
import { relativeDay } from "@skolopals/shared/format";

export const metadata = { title: "Enrolment queue" };

type Row = Awaited<ReturnType<typeof getEnrolmentQueue>>[number];

const DONE_MESSAGE: Record<string, string> = {
  approved: "Enrolment activated and the registration invoice raised.",
  declined: "Enrolment declined.",
};

/**
 * A summary only. Approving or declining happens on the review page, so the
 * admin always sees the learner's full details and aptitude result first.
 */
export default async function EnrolmentQueuePage({ searchParams }: PageProps<"/admin/enrolments">) {
  const [queue, { done }] = await Promise.all([getEnrolmentQueue(), searchParams]);
  const doneMessage = typeof done === "string" ? DONE_MESSAGE[done] : undefined;

  return (
    <>
      <PageHeading
        title="Enrolment queue"
        description="Oldest first. Open an application to review the learner and approve or decline it."
      />
      {doneMessage ? <FormMessage tone="success">{doneMessage}</FormMessage> : null}
      {queue.length === 0 ? (
        <EmptyState title="Nothing waiting" description="New enrolment requests from parents appear here." />
      ) : (
        <DataTable<Row>
          rows={queue}
          rowKey={(e) => e.id}
          rowHref={(e) => `/admin/enrolments/${e.id}`}
          columns={[
            {
              header: "Learner",
              primary: true,
              cell: (e) => (
                <Link href={`/admin/enrolments/${e.id}`} className="font-semibold text-ink hover:text-accent hover:underline">
                  {e.learners?.full_name ?? "Learner"}
                </Link>
              ),
            },
            {
              header: "Subjects",
              cell: (e) =>
                (e.enrolment_subjects ?? []).map((s) => s.subjects?.name ?? s.subject_code).join(", ") || "None chosen",
            },
            { header: "Requested", cell: (e) => relativeDay(e.created_at) },
          ]}
        />
      )}
    </>
  );
}
