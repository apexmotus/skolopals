import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardTitle, Field, Input, PageHeading, Select, buttonClass } from "@/components/ui";
import { BookingSummary } from "@/components/booking-summary";
import { DURATIONS, loadBookingContext, parseDuration, priceFor } from "@/lib/booking";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Lesson details" };

export default async function LessonDetailsPage({ params, searchParams }: PageProps<"/book/[slug]/details">) {
  await requireUser();
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await loadBookingContext(slug, typeof sp.slot === "string" ? sp.slot : undefined);
  if (!ctx) notFound();
  if (!ctx.slot) redirect(`/book/${slug}`);
  const { tutor, slot } = ctx;
  const minutes = parseDuration(sp.duration);
  const subjects = tutor.subjects.length ? tutor.subjects : ["General"];

  return (
    <div className="flex flex-col gap-5 p-4 md:p-8">
      <PageHeading title="Lesson details" description={`Booking with ${tutor.full_name} · Step 2 of 3`} />
      {/* GET form: the checkout step reads these from the URL. */}
      <form action={`/book/${slug}/checkout`} className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <input type="hidden" name="slot" value={slot.id} />
        <Card className="min-w-0 flex-1">
          <CardTitle>Lesson preferences</CardTitle>
          <Field label="Duration" htmlFor="duration">
            <Select id="duration" name="duration" defaultValue={String(minutes)}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" htmlFor="subject">
            <Select id="subject" name="subject" defaultValue={typeof sp.subject === "string" ? sp.subject : subjects[0]}>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Learning goal" htmlFor="goal">
            <Input
              id="goal"
              name="goal"
              maxLength={300}
              placeholder="Quadratic equations and exam practice"
              defaultValue={typeof sp.goal === "string" ? sp.goal : ""}
            />
          </Field>
        </Card>
        <BookingSummary tutorName={tutor.full_name} startsAt={slot.starts_at} minutes={minutes} priceCents={priceFor(tutor.hourly_rate_cents, minutes)}>
          <button className={buttonClass("primary", "w-fit")}>Continue</button>
        </BookingSummary>
      </form>
    </div>
  );
}
