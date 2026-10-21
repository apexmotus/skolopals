import Link from "next/link";
import { Card, Rating } from "@/components/ui";
import { initials } from "@/lib/format";
import type { DirectoryTutor } from "@/lib/queries";

/** Staff directory card. No price: price comes from the package, not the tutor. */
export function TutorCard({ tutor }: { tutor: DirectoryTutor }) {
  return (
    <Card className="min-w-0 flex-1">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas text-[13px] font-bold text-brand">
          {initials(tutor.full_name || "?")}
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-[15px] font-bold text-ink">{tutor.full_name}</p>
          {tutor.review_count > 0 ? <Rating rating={tutor.rating} count={tutor.review_count} /> : null}
        </div>
      </div>
      {tutor.headline ? <p className="text-[12px] text-muted">{tutor.headline}</p> : null}
      <Link href={`/tutors/${tutor.slug}`} className="text-[12px] text-brand hover:underline">
        View profile
      </Link>
    </Card>
  );
}
