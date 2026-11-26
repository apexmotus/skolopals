import Link from "next/link";
import { Badge, Card, CardTitle, DataTable, EmptyState, PageHeading, cx } from "@skolopals/ui/ui";
import { getSubjects } from "@skolopals/shared/reference";
import { relativeDay, shortDate } from "@skolopals/shared/format";
import {
  APPLICATION_FILTERS,
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  getRecruitmentRounds,
  getRetentionDue,
  getTutorApplications,
  type ApplicationFilter,
  type TutorApplicationSummary,
} from "@/lib/tutor-applications";
import { RecruitmentCard } from "./recruitment-forms";
import { PurgeButton } from "./review-forms";

export const metadata = { title: "Tutor applications" };

/**
 * The recruitment switch and the applications it brings in
 * (SPEC-2026-11-tutor-applications.md §2, §4.1). Deciding happens on the
 * detail page, with the ID, selfie and documents in view.
 */
export default async function TutorApplicationsPage({ searchParams }: PageProps<"/admin/tutor-applications">) {
  const { filter } = await searchParams;
  const current: ApplicationFilter =
    typeof filter === "string" && filter in APPLICATION_FILTERS ? (filter as ApplicationFilter) : "needs_action";

  const [rounds, rows, subjects, due] = await Promise.all([
    getRecruitmentRounds(),
    getTutorApplications(current),
    getSubjects(),
    getRetentionDue(),
  ]);
  const open = rounds.find((r) => r.isOpen);
  const lastClosed = rounds.find((r) => !r.isOpen);
  const needed = new Set(open?.needs ?? []);
  const neededNames = subjects.filter((s) => needed.has(s.code)).map((s) => s.name);

  return (
    <>
      <PageHeading
        title="Tutor applications"
        description="Open applications when the centre is recruiting. People apply from the website; you review them here."
      />

      <RecruitmentCard
        isOpen={!!open}
        round={open}
        lastRound={lastClosed}
        subjects={subjects.map((s) => ({ code: s.code, name: s.name }))}
      />

      {due.length > 0 ? (
        <Card className="border-warning">
          <CardTitle>Due for deletion</CardTitle>
          <p className="text-[13px] text-muted">
            Unsuccessful applications are kept for 12 months after the decision, then deleted with their ID, selfie and
            documents (POPIA). Each deletion is logged.
          </p>
          <ul className="flex flex-col gap-3">
            {due.map((d) => (
              <li key={d.applicationId} className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink">
                <span>
                  <span className="font-semibold">{d.name}</span>
                  <span className="text-muted">
                    {" "}
                    · {d.status === "withdrawn" ? "withdrew" : "rejected"} {shortDate(d.decidedAt)} · due {shortDate(d.dueOn)}
                  </span>
                </span>
                <PurgeButton applicationId={d.applicationId} name={d.name} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <nav aria-label="Application status" className="flex flex-wrap gap-2">
        {(Object.keys(APPLICATION_FILTERS) as ApplicationFilter[]).map((f) => (
          <Link
            key={f}
            href={f === "needs_action" ? "/admin/tutor-applications" : `/admin/tutor-applications?filter=${f}`}
            aria-current={f === current ? "page" : undefined}
            className={cx(
              "flex min-h-9 items-center rounded-full border px-3 text-[13px]",
              f === current ? "border-accent bg-white/[0.08] font-semibold text-ink" : "border-line text-muted hover:text-ink",
            )}
          >
            {APPLICATION_FILTERS[f]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description={
            current === "needs_action"
              ? open
                ? "New applications appear here as people apply."
                : "Open applications to start receiving them."
              : "No applications with this status."
          }
        />
      ) : (
        <DataTable<TutorApplicationSummary>
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/tutor-applications/${r.id}`}
          columns={[
            {
              header: "Applicant",
              primary: true,
              cell: (r) => (
                <Link
                  href={`/admin/tutor-applications/${r.id}`}
                  className="font-semibold text-ink hover:text-accent hover:underline"
                >
                  {r.firstName} {r.lastName}
                </Link>
              ),
            },
            {
              header: "Subjects",
              cell: (r) => (
                <span>
                  {r.subjectsSummary}
                  {neededNames.some((n) => r.subjectsSummary.includes(n)) ? (
                    <Badge tone="brand" className="ml-2">
                      Needed
                    </Badge>
                  ) : null}
                </span>
              ),
            },
            {
              header: "Status",
              cell: (r) => (
                <span className="flex flex-wrap gap-1">
                  <Badge tone={APPLICATION_STATUS_TONE[r.status]}>{APPLICATION_STATUS_LABEL[r.status]}</Badge>
                  {r.policeClearanceRequestedAt ? <Badge tone="warning">Clearance requested</Badge> : null}
                </span>
              ),
            },
            { header: "Applied", cell: (r) => relativeDay(r.submittedAt) },
          ]}
        />
      )}
    </>
  );
}
