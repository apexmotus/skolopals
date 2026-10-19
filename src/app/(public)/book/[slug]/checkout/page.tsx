import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardTitle, DetailRow, PageHeading } from "@/components/ui";
import { loadBookingContext, parseDuration, priceFor } from "@/lib/booking";
import { requireUser } from "@/lib/auth";
import { shortDate, time } from "@/lib/format";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Secure checkout" };

export default async function CheckoutPage({ params, searchParams }: PageProps<"/book/[slug]/checkout">) {
  await requireUser();
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await loadBookingContext(slug, typeof sp.slot === "string" ? sp.slot : undefined);
  if (!ctx) notFound();
  if (!ctx.slot) redirect(`/book/${slug}`);
  const { tutor, slot } = ctx;
  const minutes = parseDuration(sp.duration);
  const subject = typeof sp.subject === "string" ? sp.subject : tutor.subjects[0] ?? "General";
  const goal = typeof sp.goal === "string" ? sp.goal : "";
  const price = priceFor(tutor.hourly_rate_cents, minutes);

  const details = [
    { label: "Tutor", value: tutor.full_name },
    { label: "Date", value: shortDate(slot.starts_at) },
    { label: "Time", value: time(slot.starts_at) },
    { label: "Format", value: "Online" },
    { label: "Duration", value: `${minutes} minutes` },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex flex-col gap-3">
        <ol className="flex flex-wrap items-center gap-2" aria-label="Booking progress">
          {["Tutor", "Schedule", "Checkout"].map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              {i > 0 ? <img src="/icons/step-line.svg" alt="" width={40} height={1} /> : null}
              <span className="flex size-6 items-center justify-center rounded-[12px] bg-brand text-[12px] font-bold text-white">{i + 1}</span>
              <span className={i === 2 ? "text-[12px] font-bold text-brand" : "text-[12px] font-semibold text-brand"}>{step}</span>
            </li>
          ))}
        </ol>
        <PageHeading title={<span className="font-bold">Secure checkout</span>} description={`Booking with ${tutor.full_name} · Step 3 of 3`} />
      </div>

      <CheckoutForm
        slotId={slot.id}
        duration={minutes}
        subject={subject}
        goal={goal}
        tutor={{ name: tutor.full_name, headline: tutor.subjects.join(" & ") + " Tutor" }}
        startsAt={slot.starts_at}
        priceCents={price}
        backHref={`/book/${slug}/details?slot=${slot.id}&duration=${minutes}&subject=${encodeURIComponent(subject)}&goal=${encodeURIComponent(goal)}`}
      >
        <Card>
          <CardTitle>Booking details</CardTitle>
          {details.map((d, i) => (
            <div key={d.label} className="flex flex-col gap-[14px]">
              {i > 0 ? <img src="/icons/line.svg" alt="" width={746} height={1} className="h-px w-full" /> : null}
              <DetailRow label={d.label} value={d.value} />
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle>What happens next</CardTitle>
          {[
            "Review your booking details and payment information.",
            "Confirm and pay to reserve your lesson slot.",
            "Receive a confirmation email with the lesson link and next steps.",
          ].map((t, i) => (
            <div key={t} className="flex items-center gap-[10px]">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-[10px] bg-brand text-[11px] font-bold text-white">{i + 1}</span>
              <p className="text-[13px] text-muted">{t}</p>
            </div>
          ))}
        </Card>
      </CheckoutForm>
    </div>
  );
}
