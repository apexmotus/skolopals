import Link from "next/link";
import { Card, Rating } from "@skolopals/ui/ui";
import { initials } from "@skolopals/shared/format";
import type { DirectoryTutor } from "@/lib/queries";

/** Staff directory card. No price: price comes from the package, not the tutor. */
export function TutorCard({ tutor }: { tutor: DirectoryTutor }) {
  return (
    <Card className="min-w-0 flex-1">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#DCE7F3] text-[13px] font-bold text-[#1B2559]">
          {initials(tutor.fullName || "?")}
        </span>
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-[16px] font-bold leading-[1.35] text-[#1B2559]">{tutor.fullName}</h3>
          {tutor.reviewCount ? <Rating rating={tutor.rating ?? 0} count={tutor.reviewCount} /> : null}
        </div>
      </div>
      {tutor.headline ? <p className="text-[14px] leading-[1.5] text-[#334155]">{tutor.headline}</p> : null}
      <Link href={`/tutors/${tutor.slug}`} className="text-[14px] font-semibold text-[#0277BD] hover:underline">
        View profile
      </Link>
    </Card>
  );
}
