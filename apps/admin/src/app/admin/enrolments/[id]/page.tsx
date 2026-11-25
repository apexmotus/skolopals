import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, DetailRow, PageHeading } from "@skolopals/ui/ui";
import {
  AcceptForm,
  ActivateForm,
  DeclineForm,
  RequestInfoForm,
  RetakeForm,
  type Quote,
} from "../approve-form";
import { getCapacityHint, getEnrolment } from "@/lib/admin";
import { api } from "@skolopals/shared/api";
import { age, capitalise, dateTime, money, shortDate } from "@skolopals/shared/format";
import { createClient } from "@skolopals/shared/supabase/server";

/** `GET /aptitude/attempts/:id/result` as an administrator sees it (API `AptitudeResultDto`). */
type AptitudeResult = {
  completedAt: string;
  levelLabel: string;
  literacyPct: number;
  logicPct: number;
  tutorNote?: string;
  finalBand: number;
  lowConfidence: boolean;
  breakdown: {
    seq: number;
    section: string;
    skill: string;
    difficulty: number;
    stem: string;
    chosenOption: string;
    chosenText: string;
    correctOption: string;
    correctText: string;
    isCorrect: boolean;
    msTaken?: number;
  }[];
};

export const metadata = { title: "Review application" };

const STAGE_LABEL: Record<string, string> = {
  details: "Missing report card",
  assessment: "Aptitude test not finished",
  review: "Ready to review",
  payment: "Accepted, awaiting payment",
  proof: "Accepted, awaiting proof",
  verification: "Proof to check",
  activation: "Paid, not yet active",
  needs_placement: "Active, needs placement",
  active: "Active",
  paused: "Paused",
  ended: "Ended",
  declined: "Declined",
};

const STAGE_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  review: "brand",
  verification: "warning",
  activation: "warning",
  needs_placement: "warning",
  active: "success",
  declined: "danger",
};

/**
 * Everything the accept/decline decision needs, on one screen. This is the
 * only place the decision can be made (SPEC-2026-11-enrolment-payments-ux §4.4).
 */
export default async function EnrolmentReviewPage({ params }: PageProps<"/admin/enrolments/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [enrolment, { data: prices }] = await Promise.all([
    getEnrolment(id),
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

  const learner = enrolment.learners;
  const guardians = learner?.learner_guardians ?? [];
  const pending = enrolment.status === "pending";
  const stage = enrolment.progress?.stage ?? enrolment.status;
  const lapsed = enrolment.status === "declined" && enrolment.decline_reason === "Offer lapsed";

  // Each preview signs a fresh 60-second URL through the API, which logs the access (POPIA).
  const reportCard = (learner?.learner_documents ?? []).find((d) => d.doc_type === "report_card" && !d.superseded_at);
  const reportLink = reportCard
    ? await api
        .get<{ url: string; mime: string }>(`/learners/${enrolment.learner_id}/documents/${reportCard.id}/download`)
        .catch(() => null)
    : null;

  const [capacity, quote] = await Promise.all([
    getCapacityHint(learner?.grade_code ?? "", enrolment.enrolment_subjects ?? []),
    pending || lapsed
      ? api
          .get<Quote>(
            `/enrolments/quote?packageCode=${encodeURIComponent(enrolment.package_code)}&learnerId=${enrolment.learner_id}`,
          )
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  // At most one attempt is live; set-aside ones stay for the record but don't count.
  const attempt = (enrolment.aptitude_attempts ?? []).find((a) => a.status !== "abandoned");
  const answered = (attempt?.aptitude_responses ?? []).filter((r) => r.answered_at).length;
  const result =
    attempt?.status === "completed"
      ? await api.get<AptitudeResult>(`/aptitude/attempts/${attempt.id}/result`).catch(() => null)
      : null;

  return (
    <>
      <Link href="/admin/enrolments" className="w-fit text-[12px] text-accent underline-offset-2 hover:underline">
        ← Applications
      </Link>
      <PageHeading
        title={learner?.full_name ?? "Learner"}
        description={`Applied ${shortDate(enrolment.created_at)}.`}
      />
      <div>
        <Badge tone={STAGE_TONE[stage] ?? "neutral"}>{STAGE_LABEL[stage] ?? stage}</Badge>
      </div>

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
                    return `${p?.full_name ?? "Guardian"} (${capitalise(g.relationship)}${g.is_primary ? ", primary" : ""})${p?.phone ? ` · ${p.phone}` : ""}`;
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
        <CardTitle>Report card</CardTitle>
        {!reportCard ? (
          <p className="text-[13px] text-danger">No report card on file. You need one before you can accept this application.</p>
        ) : (
          <>
            <DetailRow
              label="Covers"
              value={
                reportCard.academic_year
                  ? `${reportCard.academic_year}${reportCard.term ? `, term ${reportCard.term}` : ""}`
                  : "Not given"
              }
            />
            <DetailRow label="Uploaded" value={dateTime(reportCard.uploaded_at)} />
            {reportLink ? (
              <>
                {reportLink.mime === "application/pdf" ? (
                  <iframe
                    src={reportLink.url}
                    title="Report card"
                    className="h-[560px] w-full rounded-[10px] border border-line bg-white"
                  />
                ) : (
                  <img src={reportLink.url} alt="Report card" className="max-h-[720px] w-full rounded-[10px] object-contain" />
                )}
                <a
                  href={reportLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit text-[12px] text-accent underline-offset-2 hover:underline"
                >
                  Open {reportCard.original_name} (link valid for one minute; refresh for a new one)
                </a>
              </>
            ) : (
              <p className="text-[13px] text-muted">The file could not be loaded. Refresh to try again.</p>
            )}
          </>
        )}
      </Card>

      <Card>
        <CardTitle>Aptitude test</CardTitle>
        {!attempt ? (
          <p className="text-[13px] text-muted">
            Not started yet. The parent is taken to the test straight after applying, and it stays on their portal
            until it is done.
          </p>
        ) : attempt.status === "in_progress" ? (
          <p className="text-[13px] text-muted">
            In progress: {answered} of 25 questions answered. Started {dateTime(attempt.started_at)}.
          </p>
        ) : result ? (
          <AptitudePanel result={result} />
        ) : (
          <p className="text-[13px] text-muted">Finished, but the result could not be loaded. Refresh to try again.</p>
        )}
        {attempt && pending ? <RetakeForm enrolmentId={enrolment.id} attemptId={attempt.id} /> : null}
      </Card>

      <Card>
        <CardTitle>Classes with seats</CardTitle>
        {capacity.map((c) => (
          <div key={c.subject} className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">{c.subject}</span>
            {c.options.length === 0 ? (
              <span className="text-warning">No suitable class with a free seat. The learner would need placing by hand.</span>
            ) : (
              c.options.map((o) => (
                <span key={o.id} className="text-muted">
                  {o.name}
                  {o.tutor ? ` · ${o.tutor}` : ""} · {o.free} seat{o.free === 1 ? "" : "s"} free
                </span>
              ))
            )}
          </div>
        ))}
      </Card>

      <Card>
        <CardTitle>Decision</CardTitle>
        {pending ? (
          <>
            {stage === "review" ? (
              <p className="text-[12px] text-muted">
                Accepting raises the first invoice (registration and the rest of this month) and asks the family to pay
                within 7 days. Their place starts once the payment is confirmed.
              </p>
            ) : (
              <p className="text-[12px] text-muted">
                Accepting opens once there is a report card and the aptitude test is finished.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {stage === "review" ? <AcceptForm enrolmentId={enrolment.id} quote={quote} /> : null}
              <RequestInfoForm learnerId={enrolment.learner_id} guardianIds={guardians.map((g) => g.guardian_id)} />
              <DeclineForm enrolmentId={enrolment.id} />
            </div>
          </>
        ) : enrolment.status === "accepted" ? (
          <>
            <DetailRow label="Accepted" value={enrolment.accepted_at ? dateTime(enrolment.accepted_at) : "—"} />
            <DetailRow
              label="Still to pay"
              value={money(Number(enrolment.progress?.offer_balance_cents ?? 0))}
            />
            {enrolment.progress?.offer_expires_on ? (
              <DetailRow label="Offer lapses after" value={shortDate(enrolment.progress.offer_expires_on)} />
            ) : null}
            {enrolment.progress?.open_submission_id ? (
              <Link
                href={`/admin/payments/${enrolment.progress.open_submission_id}`}
                className="w-fit text-[12px] text-accent underline-offset-2 hover:underline"
              >
                {enrolment.progress.submission_status === "submitted" ? "Check the proof of payment" : "View the payment"}
              </Link>
            ) : null}
            {stage === "activation" ? <ActivateForm enrolmentId={enrolment.id} /> : null}
          </>
        ) : lapsed ? (
          <>
            <p className="text-[13px] text-muted">The offer lapsed unpaid. Accepting again issues a fresh invoice from today.</p>
            <AcceptForm enrolmentId={enrolment.id} quote={quote} reaccept />
          </>
        ) : enrolment.status === "declined" ? (
          <DetailRow label="Declined" value={enrolment.decline_reason ?? "—"} />
        ) : (
          <>
            <DetailRow label="Started" value={enrolment.start_date ? shortDate(enrolment.start_date) : "—"} />
            {stage === "needs_placement" ? (
              <p className="text-[13px] text-warning">
                At least one subject has no class yet. Place the learner from the{" "}
                <Link href="/admin/timetable#classes" className="underline">
                  Timetable
                </Link>
                .
              </p>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}

function AptitudePanel({ result }: { result: AptitudeResult }) {
  const minutes = Math.round(result.breakdown.reduce((sum, b) => sum + (b.msTaken ?? 0), 0) / 60000);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{result.levelLabel}</Badge>
        <span className="text-[13px] text-muted">Band {result.finalBand} of 5</span>
      </div>
      {result.lowConfidence ? (
        <p className="rounded-[8px] bg-warning-soft p-3 text-[12px] text-warning">
          Low confidence: this band is more than two levels from the learner’s grade. Re-check in person before
          relying on it.
        </p>
      ) : null}
      <DetailRow label="Reading" value={`${result.literacyPct}% right`} />
      <DetailRow label="Logic" value={`${result.logicPct}% right`} />
      <DetailRow label="Finished" value={`${dateTime(result.completedAt)} · about ${minutes} min`} />
      {result.tutorNote ? <p className="text-[13px] leading-[1.6] text-ink">{result.tutorNote}</p> : null}
      <details className="rounded-[10px] border border-line">
        <summary className="cursor-pointer p-3 text-[13px] font-semibold text-ink">
          Question by question
        </summary>
        <ol className="flex flex-col divide-y divide-line">
          {result.breakdown.map((b) => (
            <li key={b.seq} className="flex flex-col gap-1 p-3 text-[12px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{b.seq}.</span>
                <Badge tone={b.isCorrect ? "success" : "danger"}>{b.isCorrect ? "Right" : "Wrong"}</Badge>
                <span className="text-muted">
                  {b.section === "literacy" ? "Reading" : `Logic · ${b.skill}`} · level {b.difficulty}
                  {b.msTaken != null ? ` · ${Math.round(b.msTaken / 1000)}s` : ""}
                </span>
              </div>
              <p className="text-ink">{b.stem}</p>
              <p className="text-muted">
                Chose {b.chosenOption}: {b.chosenText}
                {b.isCorrect ? "" : ` · Answer ${b.correctOption}: ${b.correctText}`}
              </p>
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}
