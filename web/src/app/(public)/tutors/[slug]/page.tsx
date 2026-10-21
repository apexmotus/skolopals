import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, CardTitle, DetailRow, PageHeading, Rating } from "@/components/ui";
import { getPublishedReviews, getTutorBySlug } from "@/lib/queries";
import { shortDate } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/tutors/[slug]">): Promise<Metadata> {
  const tutor = await getTutorBySlug((await params).slug);
  return { title: tutor?.full_name ?? "Tutor" };
}

export default async function TutorProfile({ params }: PageProps<"/tutors/[slug]">) {
  const tutor = await getTutorBySlug((await params).slug);
  if (!tutor) notFound();
  const reviews = await getPublishedReviews(tutor.id);

  // Group what they teach by subject, listing the grades and the languages
  // each is taught in — the three facts are distinct (see the 4NF audit).
  const bySubject = new Map<string, { grades: string[]; media: Set<string> }>();
  for (const c of tutor.competencies) {
    const name = c.subjects?.name ?? c.subject_code;
    const entry = bySubject.get(name) ?? { grades: [], media: new Set<string>() };
    if (c.grades?.name) entry.grades.push(c.grades.name);
    for (const m of c.tutor_competency_media ?? []) {
      if (m.languages?.name) entry.media.add(m.languages.name);
    }
    bySubject.set(name, entry);
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading title={tutor.full_name} description={tutor.headline} />
      {tutor.review_count > 0 ? <Rating rating={tutor.rating} count={tutor.review_count} /> : null}

      {tutor.bio ? (
        <Card>
          <CardTitle>About</CardTitle>
          <p className="text-[13px] leading-[1.6] text-black">{tutor.bio}</p>
        </Card>
      ) : null}

      <Card>
        <CardTitle>What {tutor.full_name.split(" ")[0]} teaches</CardTitle>
        {bySubject.size === 0 ? (
          <p className="text-[13px] text-muted">Not recorded yet.</p>
        ) : (
          [...bySubject.entries()].map(([subject, { grades, media }]) => (
            <div key={subject} className="flex flex-col gap-1 border-t border-line pt-3 first:border-0 first:pt-0">
              <p className="text-[13px] font-bold text-ink">{subject}</p>
              <p className="text-[12px] text-muted">{grades.join(", ")}</p>
              <div className="flex flex-wrap gap-2">
                {[...media].map((m) => (
                  <Badge key={m}>Taught in {m}</Badge>
                ))}
              </div>
            </div>
          ))
        )}
      </Card>

      {tutor.qualifications.length > 0 ? (
        <Card>
          <CardTitle>Qualifications</CardTitle>
          {tutor.qualifications.map((q) => (
            <DetailRow
              key={q.id}
              label={q.title}
              value={`${q.institution}${q.year_awarded ? ` · ${q.year_awarded}` : ""}`}
            />
          ))}
        </Card>
      ) : null}

      {tutor.spoken_languages.length > 0 ? (
        <Card>
          <CardTitle>Speaks</CardTitle>
          <p className="text-[13px] text-black">{tutor.spoken_languages.join(", ")}</p>
          <p className="text-[11px] text-muted">For parent meetings and messages.</p>
        </Card>
      ) : null}

      {reviews.length > 0 ? (
        <Card>
          <CardTitle>What parents say</CardTitle>
          {reviews.map((r) => (
            <div key={r.id} className="flex flex-col gap-1 border-t border-line pt-3 first:border-0 first:pt-0">
              <Rating rating={r.rating} count={0} />
              <p className="text-[13px] text-black">{r.comment}</p>
              <p className="text-[11px] text-muted">{r.published_at ? shortDate(r.published_at) : ""}</p>
            </div>
          ))}
        </Card>
      ) : null}

      <Card>
        <CardTitle>Request this tutor</CardTitle>
        <p className="text-[13px] text-black">
          Choose a package and name {tutor.full_name.split(" ")[0]} as your preferred tutor. The centre will
          confirm placement based on the timetable.
        </p>
        <ButtonLink href={`/enrol?tutor=${tutor.slug}`} className="w-fit">
          Start enrolment
        </ButtonLink>
      </Card>
    </div>
  );
}
