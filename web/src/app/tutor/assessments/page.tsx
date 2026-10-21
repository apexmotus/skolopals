import { Card, CardTitle, DetailRow, EmptyState, PageHeading } from "@/components/ui";
import { AssessmentForm } from "./assessment-form";
import { PlanForm } from "./plan-form";
import { getTutorContext, getMyLearners } from "@/lib/tutor";
import { getAssessmentReference, getAssessments, getLearningPlans } from "@/lib/assessment";
import { getSubjects } from "@/lib/queries";
import { shortDate } from "@/lib/format";

export const metadata = { title: "Assessments" };

export default async function AssessmentsPage() {
  const { tutor } = await getTutorContext();
  const [learners, reference, assessments, plans, subjects] = await Promise.all([
    getMyLearners(tutor.id),
    getAssessmentReference(),
    getAssessments(),
    getLearningPlans(),
    getSubjects(),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  if (learners.length === 0) {
    return (
      <>
        <PageHeading title="Assessments" description="Record how each learner is doing." />
        <EmptyState
          title="No learners yet"
          description="You can assess a learner once they are placed in one of your classes."
        />
      </>
    );
  }

  return (
    <>
      <PageHeading
        title="Assessments"
        description="Every learner starts with an initial assessment, then monthly monitoring. BP section 12."
      />

      <AssessmentForm
        learners={learners.map((l) => ({ id: l.id, full_name: l.full_name, grade_code: l.grade_code }))}
        types={reference.types}
        domains={reference.domains}
        subjects={subjects.map((s) => ({ code: s.code, name: s.name }))}
        terms={reference.terms}
        today={today}
      />

      <PlanForm
        learners={learners.map((l) => ({ id: l.id, full_name: l.full_name }))}
        subjects={subjects.map((s) => ({ code: s.code, name: s.name }))}
        levels={reference.levels}
        terms={reference.terms}
      />

      <Card>
        <CardTitle>Recent assessments</CardTitle>
        {assessments.length === 0 ? (
          <p className="text-[13px] text-muted">Nothing recorded yet.</p>
        ) : (
          assessments.map((a) => (
            <div key={a.id} className="flex flex-col gap-1 border-t border-line pt-3 first:border-0 first:pt-0">
              <p className="text-[13px] font-bold text-ink">
                {a.learners?.full_name} · {a.assessment_types?.name}
                {a.subjects?.name ? ` · ${a.subjects.name}` : ""}
              </p>
              <p className="text-[11px] text-muted">{shortDate(a.assessed_on)}</p>
              {(a.assessment_scores ?? []).map((s) => (
                <DetailRow
                  key={s.domain_code}
                  label={s.domain_code}
                  value={`${s.raw_score}/${s.max_score} · ${s.percent}% · ${s.achievement_levels?.label ?? "—"}`}
                />
              ))}
            </div>
          ))
        )}
      </Card>

      <Card>
        <CardTitle>Active learning plans</CardTitle>
        {plans.length === 0 ? (
          <p className="text-[13px] text-muted">No active plans.</p>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="flex flex-col gap-1 border-t border-line pt-3 first:border-0 first:pt-0">
              <p className="text-[13px] font-bold text-ink">{p.learners?.full_name}</p>
              {(p.learning_plan_goals ?? []).map((g) => (
                <DetailRow
                  key={g.id}
                  label={g.subjects?.name ?? g.subject_code}
                  value={`${g.goal}${g.achievement_levels?.label ? ` → ${g.achievement_levels.label}` : ""}`}
                />
              ))}
            </div>
          ))
        )}
      </Card>
    </>
  );
}
