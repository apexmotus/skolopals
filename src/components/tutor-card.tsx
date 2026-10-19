import Image from "next/image";
import { ButtonLink, Card, Rating } from "@/components/ui";
import { hourlyRate } from "@/lib/format";
import type { Tutor } from "@/lib/database.types";

export function TutorAvatar({ tutor, size = 54 }: { tutor: Pick<Tutor, "full_name" | "photo_url">; size?: number }) {
  return tutor.photo_url ? (
    <Image src={tutor.photo_url} alt="" width={size} height={size} className="shrink-0 rounded-full" />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-tint text-[14px] font-bold text-brand"
    >
      {tutor.full_name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

export function TutorCard({ tutor }: { tutor: Tutor }) {
  return (
    <Card className="min-w-0 flex-1">
      <div className="flex items-center gap-[14px]">
        <TutorAvatar tutor={tutor} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-[15px] font-bold text-ink">{tutor.full_name}</p>
          <p className="truncate text-[13px] text-muted">{tutor.headline}</p>
          <Rating rating={tutor.rating} count={tutor.review_count} />
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <p className="text-[15px] font-bold text-ink">{hourlyRate(tutor.hourly_rate_cents)}</p>
          <ButtonLink href={`/tutors/${tutor.slug}`} variant="secondary">
            View profile
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}
