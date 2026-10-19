import type { Metadata } from "next";
import { Card, CardTitle, PageHeading, Rating } from "@/components/ui";
import { getReviews } from "@/lib/queries";
import { requireTutorListing } from "@/lib/tutor";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Reviews" };

export default async function TutorReviewsPage() {
  const { tutor } = await requireTutorListing();
  const reviews = await getReviews(tutor.id, 50);
  return (
    <>
      <PageHeading title="Reviews" description="What students and families say about your lessons." />
      <Card>
        <CardTitle>
          {Number(tutor.rating).toFixed(1)} average from {tutor.review_count} reviews
        </CardTitle>
        <Rating rating={tutor.rating} count={tutor.review_count} />
        {reviews.length === 0 ? (
          <p className="text-[12px] text-muted">No reviews yet. Reviews appear after students complete lessons.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((r) => (
              <div key={r.id} className="flex flex-col gap-1">
                <p className="text-[12px] leading-[1.6] text-ink">“{r.comment}”</p>
                <p className="text-[11px] text-muted">
                  {"★".repeat(r.rating)} · {r.author_name} · {shortDate(r.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
