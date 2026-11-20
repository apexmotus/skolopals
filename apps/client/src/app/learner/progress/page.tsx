import { Card, CardTitle, DetailRow, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getPublishedReports } from "@/lib/parent";
import { shortDate } from "@skolopals/shared/format";

export const metadata = { title: "My reports" };

export default async function ProgressPage() {
  // RLS limits this to this learner's own published reports.
  const reports = await getPublishedReports();

  return (
    <>
      <PageHeading title="My reports" description="Your termly reports, once your tutor has published them." />
      {reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="A report is published at the end of each term, once your tutor has written it."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardTitle>
                Term {r.terms?.term_number} {r.terms?.year}
              </CardTitle>
              {r.summary ? <p className="text-[13px] leading-[1.6] text-black">{r.summary}</p> : null}
              {r.attendance_note ? <p className="text-[12px] text-muted">{r.attendance_note}</p> : null}

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

              <p className="text-[11px] text-muted">Issued {r.issued_on ? shortDate(r.issued_on) : "—"}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
