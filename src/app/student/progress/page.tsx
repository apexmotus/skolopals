import type { Metadata } from "next";
import { Card, CardTitle, EmptyState, PageHeading, StatCard, ButtonLink } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Progress reports" };

export default async function ProgressPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("progress_reports")
    .select("*, tutors(full_name)")
    .eq("student_id", profile.id)
    .order("created_at", { ascending: false });

  const latestBySubject = new Map<string, NonNullable<typeof reports>[number]>();
  for (const r of reports ?? []) if (!latestBySubject.has(r.subject)) latestBySubject.set(r.subject, r);
  const latest = reports?.[0];

  return (
    <>
      <PageHeading title="Progress reports" description="Tutor updates across your learning goals." />
      {!latest ? (
        <EmptyState
          title="No reports yet"
          description="After a few lessons your tutor will share progress updates here, including strengths and what to focus on next."
        >
          <ButtonLink href="/student/upcoming" variant="secondary">
            View your lessons
          </ButtonLink>
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-[14px] md:flex-row">
            {[...latestBySubject.values()].slice(0, 3).map((r) => (
              <StatCard key={r.subject} label={r.subject} value={r.score_label} hint={r.trend || undefined} />
            ))}
          </div>
          <Card>
            <CardTitle>Latest tutor report</CardTitle>
            <p className="text-[12px] leading-[1.6] text-ink">{latest.summary}</p>
            <p className="text-[11px] text-muted">
              {latest.tutors?.full_name} · {latest.subject} · {shortDate(latest.created_at)}
            </p>
          </Card>
        </>
      )}
    </>
  );
}
