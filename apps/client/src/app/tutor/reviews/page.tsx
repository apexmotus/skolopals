import { Card, EmptyState, PageHeading, Rating } from "@skolopals/ui/ui";
import { getMyReviews, getTutorContext } from "@/lib/tutor";
import { shortDate } from "@skolopals/shared/format";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const { tutor } = await getTutorContext();
  const reviews = await getMyReviews(tutor.id);
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <>
      <PageHeading title="Reviews" description="Reviews parents have left, once an administrator has published them." />
      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" description="Published reviews from parents will appear here." />
      ) : (
        <div className="flex flex-col gap-4">
          <Rating rating={average} count={reviews.length} className="text-[13px]" />
          {reviews.map((r) => (
            <Card key={r.id}>
              <p className="text-[13px] text-star">{"★".repeat(r.rating) + "☆".repeat(5 - r.rating)}</p>
              {r.comment ? <p className="text-[13px] leading-[1.6] text-black">{r.comment}</p> : null}
              <p className="text-[11px] text-muted">{shortDate(r.publishedAt ?? r.createdAt)}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
