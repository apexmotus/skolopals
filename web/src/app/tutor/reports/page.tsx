import { Badge, Card, CardTitle, DetailRow, EmptyState, PageHeading } from "@/components/ui";
import { ReportForm } from "./report-form";
import { getTutorContext, getMyLearners } from "@/lib/tutor";
import { getAssessmentReference, getReports } from "@/lib/assessment";
import { getSubjects } from "@/lib/queries";
import { shortDate } from "@/lib/format";

export const metadata = { title: "Progress reports" };

export default async function ReportsPage() {
  const { tutor } = await getTutorContext();
  const [learners, reference, reports, subjects] = await Promise.all([
    getMyLearners(tutor.id),
    getAssessmentReference(),
    getReports(),
    getSubjects(),
  ]);

  if (learners.length === 0 || reference.terms.length === 0) {
    return (
      <>
        <PageHeading title="Progress reports" description="A termly report for each learner you teach." />
        <EmptyState
          title={learners.length === 0 ? "No learners yet" : "No terms defined"}
          description={
            learners.length === 0
              ? "You can write a report once a learner is placed in one of your classes."
              : "An administrator needs to add this year's school terms first."
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeading
        title="Progress reports"
        description="Strengths, areas for improvement and a recommended intervention, per subject."
      />

      <ReportForm
        learners={learners.map((l) => ({ id: l.id, full_name: l.full_name }))}
        subjects={subjects.map((s) => ({ code: s.code, name: s.name }))}
        levels={reference.levels}
        terms={reference.terms}
      />

      <Card>
        <CardTitle>Reports you have written</CardTitle>
        {reports.length === 0 ? (
          <p className="text-[13px] text-muted">Nothing yet.</p>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-bold text-ink">
                  {r.learners?.full_name} — Term {r.terms?.term_number} {r.terms?.year}
                </p>
                {r.published_at ? (
                  <Badge tone="success">Published {shortDate(r.published_at)}</Badge>
                ) : (
                  <Badge tone="warning">Draft — parent cannot see it</Badge>
                )}
              </div>
              {(r.progress_report_subjects ?? []).map((s) => (
                <DetailRow
                  key={s.id}
                  label={s.subjects?.name ?? s.subject_code}
                  value={s.achievement_levels?.label ?? "No level"}
                />
              ))}
              {(r.report_acknowledgements ?? []).length > 0 ? (
                <p className="text-[11px] text-success">
                  Parent acknowledged
                  {r.report_acknowledgements[0]?.comment
                    ? `: “${r.report_acknowledgements[0].comment}”`
                    : "."}
                </p>
              ) : r.published_at ? (
                <p className="text-[11px] text-muted">Awaiting the parent&rsquo;s acknowledgement.</p>
              ) : null}
            </div>
          ))
        )}
      </Card>
    </>
  );
}
