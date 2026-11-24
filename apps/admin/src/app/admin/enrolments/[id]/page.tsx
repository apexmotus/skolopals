import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, DetailRow, PageHeading } from "@skolopals/ui/ui";
import { ApproveForm } from "../approve-form";
import { getEnrolment, getTutors } from "@/lib/admin";
import { ENROLMENT_STATUS_LABEL, age, money, shortDate } from "@skolopals/shared/format";
import { createClient } from "@skolopals/shared/supabase/server";

export const metadata = { title: "Review enrolment" };

/**
 * Everything the accept/decline decision needs, on one screen. This is the
 * only place the decision can be made (SPEC-2026-11-enrolment-payments-ux §4.4).
 */
export default async function EnrolmentReviewPage({ params }: PageProps<"/admin/enrolments/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [enrolment, tutors, { data: prices }] = await Promise.all([
    getEnrolment(id),
    getTutors(),
    supabase.from("package_prices").select("package_code, amount_cents, effective_from, effective_to"),
  ]);
  if (!enrolment) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const price =
    (prices ?? []).find(
      (p) =>
        p.package_code === enrolment.package_code &&
        p.effective_from <= today &&
        (!p.effective_to || p.effective_to > today),
    )?.amount_cents ?? null;

  const active = tutors
    .filter((t) => t.status === "active")
    .map((t) => ({ id: t.id, full_name: t.profiles?.full_name ?? t.slug }));

  const learner = enrolment.learners;
  const guardians = learner?.learner_guardians ?? [];
  const pending = enrolment.status === "pending";

  return (
    <>
      <Link href="/admin/enrolments" className="w-fit text-[12px] text-accent underline-offset-2 hover:underline">
        ← Enrolment queue
      </Link>
      <PageHeading
        title={learner?.full_name ?? "Learner"}
        description={`Requested ${shortDate(enrolment.created_at)}.`}
      />

      <Card>
        <CardTitle>Learner</CardTitle>
        <DetailRow label="Grade" value={learner?.grades?.name ?? learner?.grade_code ?? "—"} />
        <DetailRow label="Age" value={learner?.date_of_birth ? `${age(learner.date_of_birth)} years` : "—"} />
        <DetailRow label="School" value={learner?.school_name || "—"} />
        <DetailRow label="Home language" value={learner?.languages?.name ?? "Not given"} />
        <DetailRow
          label="Guardians"
          value={
            guardians.length === 0
              ? "None linked"
              : guardians
                  .map((g) => {
                    const p = g.guardians?.profiles;
                    return `${p?.full_name ?? "Guardian"} (${g.relationship}${g.is_primary ? ", primary" : ""})${p?.phone ? ` · ${p.phone}` : ""}`;
                  })
                  .join(", ")
          }
        />
      </Card>

      <Card>
        <CardTitle>Requested</CardTitle>
        <DetailRow
          label="Package"
          value={`${enrolment.packages?.name ?? enrolment.package_code}${price != null ? ` · ${money(price)}/month` : ""}`}
        />
        <DetailRow
          label="Subjects"
          value={
            (enrolment.enrolment_subjects ?? [])
              .map(
                (s) =>
                  `${s.subjects?.name ?? s.subject_code}${s.languages?.name ? ` (in ${s.languages.name})` : ""}`,
              )
              .join(", ") || "None chosen"
          }
        />
        <DetailRow
          label="Preferred tutor"
          value={
            enrolment.tutors?.profiles?.full_name ? (
              <Badge tone="brand">{enrolment.tutors.profiles.full_name}</Badge>
            ) : (
              "No preference"
            )
          }
        />
      </Card>

      <Card>
        <CardTitle>Aptitude test</CardTitle>
        {/* Placeholder until the aptitude test ships (SPEC §4.3). Results will show band, level,
            literacy and logic percentages, the tutor note and the item breakdown here. */}
        <p className="text-[13px] text-muted">No aptitude test on record for this learner.</p>
      </Card>

      <Card>
        <CardTitle>Decision</CardTitle>
        {pending ? (
          <>
            <p className="text-[12px] text-muted">
              Approving activates the enrolment, opens a billing account and raises the registration invoice.
            </p>
            <ApproveForm
              enrolmentId={enrolment.id}
              tutors={active}
              preferredTutorId={enrolment.preferred_tutor_id}
              today={today}
            />
          </>
        ) : (
          <DetailRow
            label="Status"
            value={
              ENROLMENT_STATUS_LABEL[enrolment.status as keyof typeof ENROLMENT_STATUS_LABEL] ?? enrolment.status
            }
          />
        )}
      </Card>
    </>
  );
}
