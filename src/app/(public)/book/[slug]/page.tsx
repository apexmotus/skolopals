import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink, Card, CardTitle, EmptyState, PageHeading, buttonClass } from "@/components/ui";
import { BookingSummary } from "@/components/booking-summary";
import { SlotPicker } from "@/components/slot-picker";
import { getOpenSlots } from "@/lib/queries";
import { loadBookingContext, priceFor } from "@/lib/booking";

export const metadata: Metadata = { title: "Choose a time" };

export default async function SelectTimePage({ params, searchParams }: PageProps<"/book/[slug]">) {
  const { slug } = await params;
  const { slot: slotParam } = await searchParams;
  const ctx = await loadBookingContext(slug, typeof slotParam === "string" ? slotParam : undefined);
  if (!ctx) notFound();
  const { tutor, slot } = ctx;
  const slots = await getOpenSlots(tutor.id);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-8">
      <PageHeading title="Choose a date and time" description={`Booking with ${tutor.full_name} · Step 1 of 3`} />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Card>
            <CardTitle>Availability calendar</CardTitle>
            {slots.length ? (
              <SlotPicker slots={slots} selectedId={slot?.id} hrefFor={(s) => `/book/${slug}?slot=${s.id}`} />
            ) : (
              <EmptyState
                title="No open times right now"
                description={`${tutor.full_name} has no free slots in the next two weeks. Try another tutor or check back soon.`}
              >
                <ButtonLink href="/tutors" variant="secondary">
                  See other tutors
                </ButtonLink>
              </EmptyState>
            )}
          </Card>
          <Card>
            <CardTitle>Your timezone</CardTitle>
            <p className="text-[12px] text-black">Europe/London (UK time)</p>
          </Card>
        </div>
        <BookingSummary tutorName={tutor.full_name} startsAt={slot?.starts_at ?? null} minutes={60} priceCents={priceFor(tutor.hourly_rate_cents, 60)}>
          {slot ? (
            <ButtonLink href={`/book/${slug}/details?slot=${slot.id}`} className="w-fit">
              Continue
            </ButtonLink>
          ) : (
            <span aria-disabled className={buttonClass("primary", "w-fit opacity-50")}>
              Continue
            </span>
          )}
        </BookingSummary>
      </div>
    </div>
  );
}
