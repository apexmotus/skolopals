import { ButtonLink, Card, CardTitle } from "@skolopals/ui/ui";
import { Stepper } from "@skolopals/ui/stepper";
import { firstName, money, shortDate } from "@skolopals/shared/format";
import { getPaymentContext } from "@/lib/payments";
import { PayButton } from "@/components/payments/payment-dialog";
import { ReplaceReportCard } from "./replace-report-card";

/** The journey header every application shows (SPEC §0.1). */
const JOURNEY = [
  { id: "enrol", label: "Enrol" },
  { id: "assess", label: "Assess" },
  { id: "review", label: "Review" },
  { id: "pay", label: "Pay" },
  { id: "done", label: "Done" },
];

const JOURNEY_STEP: Record<string, number> = {
  details: 0,
  assessment: 1,
  review: 2,
  payment: 3,
  proof: 3,
  verification: 3,
  activation: 4,
  needs_placement: 4,
};

export type Application = {
  enrolment_id: string | null;
  stage: string | null;
  offer_invoice_id: string | null;
  offer_balance_cents: number | null;
  offer_expires_on: string | null;
  decline_reason: string | null;
  learnerName: string;
};

/**
 * "Continue enrolment" for one application: where it is and the one thing
 * to do next. The stage is derived in the database, never stored (§4.5).
 * Copy never promises a turnaround time (D11).
 */
export async function ApplicationCard({ app, currentYear }: { app: Application; currentYear: number }) {
  const id = app.enrolment_id ?? "";
  const name = firstName(app.learnerName);
  const stage = app.stage ?? "";
  const payment =
    app.offer_invoice_id && ["payment", "proof", "verification"].includes(stage)
      ? await getPaymentContext(app.offer_invoice_id)
      : null;

  if (stage === "declined") {
    const lapsed = app.decline_reason === "Offer lapsed";
    return (
      <Card id={`application-${id}`} className="scroll-mt-6 target:ring-2 target:ring-accent">
        <CardTitle>{lapsed ? `${name}’s offer has lapsed` : `Update on ${name}’s application`}</CardTitle>
        <p className="text-[13px] leading-[1.6] text-ink">
          {lapsed
            ? "We did not receive payment in time, so the place was released. Please contact the centre if you would still like a place."
            : `We are sorry, we could not offer a place this time. Reason: ${app.decline_reason}.`}
        </p>
        <ButtonLink href="/contact" variant="secondary" className="w-fit">
          Contact the centre
        </ButtonLink>
      </Card>
    );
  }

  return (
    <Card id={`application-${id}`} className="scroll-mt-6 border-l-4 border-l-accent target:ring-2 target:ring-accent">
      <CardTitle>{stage === "needs_placement" || stage === "activation" ? `${name} is enrolled` : `Continue ${name}’s application`}</CardTitle>
      <Stepper steps={JOURNEY} current={JOURNEY_STEP[stage] ?? 0} label={`${name}’s application`} />

      {stage === "details" ? (
        <>
          <p className="text-[13px] leading-[1.6] text-ink">
            We still need {name}’s most recent school report card. Upload it here, then {name} does the short aptitude test.
          </p>
          <ReplaceReportCard enrolmentId={id} currentYear={currentYear} mode="upload" />
        </>
      ) : null}

      {stage === "assessment" ? (
        <>
          <p className="text-[13px] leading-[1.6] text-ink">
            {name} still needs to do a short aptitude test (about 20 minutes). The centre reviews the application once it is
            done. If {name} has already started, the answers so far are saved.
          </p>
          <ButtonLink href={`/enrol/${id}/assessment`} className="w-fit">
            Go to the test
          </ButtonLink>
        </>
      ) : null}

      {stage === "review" ? (
        <>
          <p className="text-[13px] leading-[1.6] text-ink">
            {name}’s application is with the centre for review. We’ll let you know as soon as a decision has been made.
          </p>
          <ReplaceReportCard enrolmentId={id} currentYear={currentYear} />
        </>
      ) : null}

      {payment && stage === "payment" ? (
        <>
          <p className="text-[13px] leading-[1.6] text-ink">
            Good news: {name}’s application has been accepted. Please pay{" "}
            <span className="font-bold">{money(app.offer_balance_cents ?? payment.invoice.balanceCents)}</span>
            {app.offer_expires_on ? ` by ${shortDate(app.offer_expires_on)}` : ""} to secure the place.
          </p>
          <PayButton ctx={payment} deadline={app.offer_expires_on} className="w-fit" />
        </>
      ) : null}

      {payment && stage === "proof" ? (
        <>
          <p className="text-[13px] leading-[1.6] text-ink">
            You told us you have paid. Please upload the proof of payment so the centre can confirm it
            {app.offer_expires_on ? ` before ${shortDate(app.offer_expires_on)}` : ""}.
          </p>
          <PayButton ctx={payment} label="Upload proof of payment" deadline={app.offer_expires_on} className="w-fit" />
        </>
      ) : null}

      {payment && stage === "verification" ? (
        <>
          <p className="text-[13px] leading-[1.6] text-ink">
            We’re checking your payment. We’ll let you know as soon as it’s confirmed.
          </p>
          <PayButton ctx={payment} label="View payment" className="w-fit" />
        </>
      ) : null}

      {stage === "activation" ? (
        <p className="text-[13px] leading-[1.6] text-ink">Payment received. We’re finishing {name}’s enrolment.</p>
      ) : null}

      {stage === "needs_placement" ? (
        <p className="text-[13px] leading-[1.6] text-ink">
          Payment confirmed. We’re finalising {name}’s classes and will let you know when the timetable is ready.
        </p>
      ) : null}
    </Card>
  );
}
