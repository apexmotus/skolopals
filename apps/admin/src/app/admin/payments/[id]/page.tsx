import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, DetailRow, PageHeading } from "@skolopals/ui/ui";
import { api } from "@skolopals/shared/api";
import { dateTime, money, shortDate } from "@skolopals/shared/format";
import { getPaymentSubmission } from "@/lib/admin";
import { RejectForm, VerifyForm } from "../review-forms";

export const metadata = { title: "Check payment" };

const STATUS_LABEL: Record<string, string> = {
  awaiting_proof: "Waiting for proof",
  submitted: "To check",
  verified: "Verified",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/** One proof of payment beside everything needed to judge it (SPEC §3.2). */
export default async function PaymentReviewPage({ params }: PageProps<"/admin/payments/[id]">) {
  const { id } = await params;
  const data = await getPaymentSubmission(id);
  if (!data) notFound();
  const { submission, lines, balanceCents, accountBalanceCents, history } = data;
  const proof = submission.proof_storage_path
    ? await api.get<{ url: string; mime: string }>(`/payment-submissions/${id}/proof`).catch(() => null)
    : null;
  const family = submission.billing_accounts?.guardians?.profiles;

  return (
    <>
      <Link href="/admin/payments" className="w-fit text-[12px] text-accent underline-offset-2 hover:underline">
        ← Payments
      </Link>
      <PageHeading
        title={`${family?.full_name ?? "Family"} · ${submission.invoices?.invoice_number ?? ""}`}
        description={submission.proof_uploaded_at ? `Proof sent ${dateTime(submission.proof_uploaded_at)}.` : undefined}
      />
      <div>
        <Badge tone={submission.status === "submitted" ? "warning" : submission.status === "verified" ? "success" : "neutral"}>
          {STATUS_LABEL[submission.status] ?? submission.status}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardTitle>Proof of payment</CardTitle>
          {!proof ? (
            <p className="text-[13px] text-muted">No proof to show.</p>
          ) : proof.mime === "application/pdf" ? (
            <iframe src={proof.url} title="Proof of payment" className="h-[640px] w-full rounded-[10px] border border-line bg-white" />
          ) : (
            <a href={proof.url} target="_blank" rel="noreferrer" title="Open full size">
              <img src={proof.url} alt="Proof of payment" className="max-h-[720px] w-full cursor-zoom-in rounded-[10px] object-contain" />
            </a>
          )}
          {proof ? (
            <a href={proof.url} target="_blank" rel="noreferrer" className="w-fit text-[12px] text-accent underline-offset-2 hover:underline">
              Open or download (link valid for one minute; refresh for a new one)
            </a>
          ) : null}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>What the parent says</CardTitle>
            <DetailRow label="Amount" value={submission.claimed_amount_cents ? money(submission.claimed_amount_cents) : "Not given"} />
            <DetailRow label="Paid on" value={submission.claimed_paid_on ? shortDate(submission.claimed_paid_on) : "Not given"} />
            <DetailRow label="Their reference" value={submission.payer_reference || "—"} />
            <DetailRow label="Phone" value={family?.phone || "—"} />
          </Card>

          <Card>
            <CardTitle>Invoice</CardTitle>
            {lines.map((l) => (
              <DetailRow key={l.id} label={`${l.description}${l.learners?.full_name ? ` · ${l.learners.full_name}` : ""}`} value={money(l.line_total_cents ?? 0)} />
            ))}
            <div className="border-t border-line pt-3">
              <DetailRow label="Balance on this invoice" value={money(balanceCents)} />
              <DetailRow label="Whole account owes" value={money(accountBalanceCents)} />
            </div>
          </Card>

          {submission.status === "submitted" ? (
            <>
              <Card>
                <CardTitle>Verify</CardTitle>
                <VerifyForm
                  submissionId={submission.id}
                  claimedCents={submission.claimed_amount_cents}
                  claimedPaidOn={submission.claimed_paid_on}
                  balanceCents={balanceCents}
                  reference={submission.payer_reference}
                />
              </Card>
              <Card>
                <CardTitle>Reject</CardTitle>
                <RejectForm submissionId={submission.id} />
              </Card>
            </>
          ) : submission.reviewed_at ? (
            <Card>
              <DetailRow
                label={submission.status === "verified" ? "Verified" : "Reviewed"}
                value={`${submission.reviewer?.full_name ?? "Admin"} · ${dateTime(submission.reviewed_at)}`}
              />
              {submission.rejection_reason ? <DetailRow label="Reason" value={submission.rejection_reason} /> : null}
            </Card>
          ) : null}

          {history.length > 0 ? (
            <Card>
              <CardTitle>Earlier attempts on this invoice</CardTitle>
              {history.map((h) => (
                <DetailRow
                  key={h.id}
                  label={`${STATUS_LABEL[h.status] ?? h.status}${h.proof_uploaded_at ? ` · ${dateTime(h.proof_uploaded_at)}` : ""}`}
                  value={h.rejection_reason ?? (h.claimed_amount_cents ? money(h.claimed_amount_cents) : "—")}
                />
              ))}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
