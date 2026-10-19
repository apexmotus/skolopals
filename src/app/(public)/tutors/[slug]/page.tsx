import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Rating } from "@/components/ui";
import { SlotPicker } from "@/components/slot-picker";
import { getOpenSlots, getReviews, getTutorBySlug } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/tutors/[slug]">): Promise<Metadata> {
  const tutor = await getTutorBySlug((await params).slug);
  return { title: tutor?.full_name ?? "Tutor" };
}

export default async function TutorProfilePage({ params }: PageProps<"/tutors/[slug]">) {
  const { slug } = await params;
  const tutor = await getTutorBySlug(slug);
  if (!tutor) notFound();

  const [slots, reviews] = await Promise.all([getOpenSlots(tutor.id), getReviews(tutor.id)]);
  const photo = tutor.slug === "maya-thompson" ? "/images/tutor-maya-large.png" : tutor.photo_url;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {photo ? (
          <Image src={photo} alt={tutor.full_name} width={220} height={220} className="size-[220px] shrink-0 rounded-[10px] object-cover" />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
          <Badge tone="success">Verified tutor</Badge>
          <h1 className="text-[32px] text-black">{tutor.full_name}</h1>
          <Rating rating={tutor.rating} count={tutor.review_count} className="text-[12px]" />
          <p className="text-[15px] leading-[1.5] text-muted">{tutor.bio}</p>
          <p className="text-[13px] text-black">{tutor.qualifications}</p>
        </div>
        <Card className="w-full shrink-0 lg:w-[250px]">
          <p className="text-[20px] font-bold text-ink">${Math.round(tutor.hourly_rate_cents / 100)} / hour</p>
          <ButtonLink href={`/book/${tutor.slug}`} className="w-fit">
            Book a Lesson
          </ButtonLink>
          <p className="text-[11px] text-muted">Free 20-minute intro call</p>
        </Card>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1">
          <CardTitle>Subjects &amp; qualifications</CardTitle>
          <div className="text-[12px] leading-[1.6] text-black">
            <p>{(tutor.topics.length ? tutor.topics : tutor.subjects).join(" · ")}</p>
            <p>Enhanced background check · Identity verified</p>
          </div>
        </Card>
        <Card className="min-w-0 flex-1">
          <CardTitle>Availability calendar</CardTitle>
          {slots.length > 0 ? (
            <SlotPicker slots={slots} hrefFor={(s) => `/book/${tutor.slug}?slot=${s.id}`} days={5} maxPerDay={2} />
          ) : (
            <NoAvailability name={tutor.full_name} />
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Recent reviews</CardTitle>
        {reviews.length ? (
          reviews.map((r) => (
            <p key={r.id} className="text-[12px] text-black">
              “{r.comment}” - {r.author_name}
            </p>
          ))
        ) : (
          <p className="text-[12px] text-muted">No reviews yet.</p>
        )}
      </Card>
    </div>
  );
}

function NoAvailability({ name }: { name: string }) {
  return (
    <EmptyState
      title="No open times this week"
      description={`${name.split(" ")[0]} is fully booked right now. Send a message or check back soon — new times are added every week.`}
    >
      <ButtonLink href="/tutors" variant="secondary">
        See other tutors
      </ButtonLink>
      <ButtonLink href="/contact">Get notified</ButtonLink>
    </EmptyState>
  );
}
