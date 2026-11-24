import Link from "next/link";
import { Badge, DataTable, EmptyState, FormMessage, PageHeading, cx } from "@skolopals/ui/ui";
import { APPLICATION_TABS, getApplications, type ApplicationTab } from "@/lib/admin";
import { relativeDay, shortDate } from "@skolopals/shared/format";

export const metadata = { title: "Applications" };

type Row = Awaited<ReturnType<typeof getApplications>>[number];

const DONE_MESSAGE: Record<string, string> = {
  accepted: "Accepted. The family has been sent the invoice and asked to pay within 7 days.",
  declined: "Declined. The family has been told the reason.",
};

const STAGE_LABEL: Record<string, string> = {
  details: "No report card",
  assessment: "Test not finished",
  review: "Ready to review",
  payment: "Awaiting payment",
  proof: "Awaiting proof",
  verification: "Proof to check",
  activation: "Paid, not active",
  needs_placement: "Needs placement",
  declined: "Declined",
};

/** How long an item has waited for whoever acts next, so nothing sits unnoticed (D11). */
function waiting(row: Row) {
  const since = row.stage === "review" || row.stage === "declined" || !row.accepted_at ? row.created_at : row.accepted_at;
  return since ? relativeDay(since) : "—";
}

/**
 * Applications by derived stage (SPEC §4.4, §4.5). A summary only: deciding
 * happens on the review page, with the report card and test result in view.
 */
export default async function ApplicationsPage({ searchParams }: PageProps<"/admin/enrolments">) {
  const [rows, { done, tab }] = await Promise.all([getApplications(), searchParams]);
  const doneMessage = typeof done === "string" ? DONE_MESSAGE[done] : undefined;
  const current: ApplicationTab = typeof tab === "string" && tab in APPLICATION_TABS ? (tab as ApplicationTab) : "review";
  const inTab = (t: ApplicationTab) =>
    rows.filter((r) => (APPLICATION_TABS[t].stages as readonly string[]).includes(r.stage ?? ""));
  const visible = inTab(current);

  return (
    <>
      <PageHeading
        title="Applications"
        description="Oldest first. Open an application to see the report card and test result, then accept or decline."
      />
      {doneMessage ? <FormMessage tone="success">{doneMessage}</FormMessage> : null}

      <nav aria-label="Application stages" className="flex flex-wrap gap-2">
        {(Object.keys(APPLICATION_TABS) as ApplicationTab[]).map((t) => (
          <Link
            key={t}
            href={t === "review" ? "/admin/enrolments" : `/admin/enrolments?tab=${t}`}
            aria-current={t === current ? "page" : undefined}
            className={cx(
              "flex min-h-9 items-center gap-2 rounded-full border px-3 text-[13px]",
              t === current ? "border-accent bg-white/[0.08] font-semibold text-ink" : "border-line text-muted hover:text-ink",
            )}
          >
            {APPLICATION_TABS[t].label}
            <span className="rounded-full bg-white/[0.1] px-2 text-[12px]">{inTab(t).length}</span>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description={current === "review" ? "Applications appear here once the report card is in and the test is done." : "No applications at this stage."}
        />
      ) : (
        <DataTable<Row>
          rows={visible}
          rowKey={(r) => r.enrolment_id ?? ""}
          rowHref={(r) => `/admin/enrolments/${r.enrolment_id}`}
          columns={[
            {
              header: "Learner",
              primary: true,
              cell: (r) => (
                <Link href={`/admin/enrolments/${r.enrolment_id}`} className="font-semibold text-ink hover:text-accent hover:underline">
                  {r.learnerName}
                </Link>
              ),
            },
            { header: "Subjects", cell: (r) => r.subjects.join(", ") || "None chosen" },
            {
              header: "Stage",
              cell: (r) => (
                <Badge tone={r.stage === "verification" || r.stage === "needs_placement" ? "warning" : "neutral"}>
                  {r.stage === "declined" && r.decline_reason === "Offer lapsed" ? "Offer lapsed" : (STAGE_LABEL[r.stage ?? ""] ?? r.stage)}
                </Badge>
              ),
            },
            {
              header: current === "payment" ? "Pay by" : "Waiting since",
              cell: (r) => (current === "payment" && r.offer_expires_on ? shortDate(r.offer_expires_on) : waiting(r)),
            },
          ]}
        />
      )}
    </>
  );
}
