import { Badge, Card, CardTitle, DetailRow, EmptyState, PageHeading } from "@/components/ui";
import { ApproveForm } from "./approve-form";
import { getEnrolmentQueue, getTutors } from "@/lib/admin";
import { age, money, shortDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Enrolment queue" };

export default async function EnrolmentQueuePage() {
  const [queue, tutors] = await Promise.all([getEnrolmentQueue(), getTutors()]);
  const today = new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: prices } = await supabase
    .from("package_prices")
    .select("package_code, amount_cents, effective_from, effective_to");
  const priceOf = (code: string) =>
    (prices ?? []).find(
      (p) => p.package_code === code && p.effective_from <= today && (!p.effective_to || p.effective_to > today),
    )?.amount_cents ?? null;

  const active = tutors
    .filter((t) => t.status === "active")
    .map((t) => ({ id: t.id, full_name: t.profiles?.full_name ?? t.slug }));

  return (
    <>
      <PageHeading
        title="Enrolment queue"
        description="Approving activates the enrolment, opens a billing account and raises the registration invoice."
      />
      {queue.length === 0 ? (
        <EmptyState title="Nothing waiting" description="New enrolment requests from parents appear here." />
      ) : (
        <div className="flex flex-col gap-4">
          {queue.map((e) => (
            <Card key={e.id}>
              <CardTitle>{e.learners?.full_name ?? "Learner"}</CardTitle>
              <DetailRow
                label="Grade"
                value={e.learners?.grade_code?.replace("grade_", "Grade ").replace("Grade r", "Grade R") ?? "—"}
              />
              <DetailRow
                label="Age"
                value={e.learners?.date_of_birth ? `${age(e.learners.date_of_birth)} years` : "—"}
              />
              <DetailRow
                label="Package"
                value={
                  <>
                    {e.packages?.name}
                    {priceOf(e.package_code) != null ? ` · ${money(priceOf(e.package_code)!)}/month` : ""}
                  </>
                }
              />
              <DetailRow
                label="Subjects"
                value={
                  (e.enrolment_subjects ?? [])
                    .map((s) => `${s.subjects?.name ?? s.subject_code}${s.preferred_language_code ? ` (${s.preferred_language_code})` : ""}`)
                    .join(", ") || "None chosen"
                }
              />
              <DetailRow
                label="Preferred tutor"
                value={
                  e.tutors?.profiles?.full_name ? (
                    <Badge tone="brand">{e.tutors.profiles.full_name}</Badge>
                  ) : (
                    "No preference"
                  )
                }
              />
              <DetailRow label="Requested" value={shortDate(e.created_at)} />
              <div className="border-t border-line pt-4">
                <ApproveForm
                  enrolmentId={e.id}
                  tutors={active}
                  preferredTutorId={e.preferred_tutor_id}
                  today={today}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
