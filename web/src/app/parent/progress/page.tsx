import { Card, CardTitle, DetailRow, EmptyState, PageHeading } from "@/components/ui";
import { AcknowledgeForm } from "./acknowledge-form";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shortDate } from "@/lib/format";

export const metadata = { title: "Progress reports" };

export default async function ProgressPage() {
  const session = await getSession();
  const supabase = await createClient();

  // RLS already limits this to published reports for this family's learners.
  const { data: reports } = await supabase
    .from("progress_reports")
    .select(
      "*, learners(full_name), terms(year, term_number), progress_report_subjects(*, subjects(name), achievement_levels(label)), report_acknowledgements(guardian_id, acknowledged_at, comment)",
    )
    .not("published_at", "is", null)
    .order("issued_on", { ascending: false });

  const rows = reports ?? [];

  return (
    <>
      <PageHeading
        title="Progress reports"
        description="A report at the end of each school term, with what is going well and what we are working on."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="A report is published at the end of each term, once your learner's tutor has written it."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((r) => {
            const mine = (r.report_acknowledgements ?? []).find(
              (a) => a.guardian_id === session?.profile.id,
            );
            return (
              <Card key={r.id}>
                <CardTitle>
                  {r.learners?.full_name} — Term {r.terms?.term_number} {r.terms?.year}
                </CardTitle>
                {r.summary ? <p className="text-[13px] leading-[1.6] text-black">{r.summary}</p> : null}
                {r.attendance_note ? (
                  <p className="text-[12px] text-muted">{r.attendance_note}</p>
                ) : null}

                {(r.progress_report_subjects ?? []).map((s) => (
                  <div key={s.id} className="flex flex-col gap-1 border-t border-line pt-3">
                    <p className="text-[13px] font-bold text-ink">{s.subjects?.name ?? s.subject_code}</p>
                    <DetailRow label="Achievement" value={s.achievement_levels?.label ?? "—"} />
                    {s.strengths ? <DetailRow label="Strengths" value={s.strengths} /> : null}
                    {s.areas_for_improvement ? (
                      <DetailRow label="To improve" value={s.areas_for_improvement} />
                    ) : null}
                    {s.recommended_intervention ? (
                      <DetailRow label="What we will do" value={s.recommended_intervention} />
                    ) : null}
                  </div>
                ))}

                <p className="text-[11px] text-muted">
                  Issued {r.issued_on ? shortDate(r.issued_on) : "—"}
                </p>

                {mine ? (
                  <p className="border-t border-line pt-3 text-[12px] text-success">
                    You acknowledged this on {shortDate(mine.acknowledged_at)}
                    {mine.comment ? ` — “${mine.comment}”` : "."}
                  </p>
                ) : (
                  <AcknowledgeForm reportId={r.id} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
