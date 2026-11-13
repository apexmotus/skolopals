import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, CardTitle, DetailRow, PageHeading, Rating } from "@skolopals/ui/ui";
import { getGrades, getLanguages, getPublishedReviews, getSubjects, getTutorBySlug } from "@/lib/queries";
import { shortDate } from "@skolopals/shared/format";

export async function generateMetadata({ params }: PageProps<"/tutors/[slug]">): Promise<Metadata> {
  const tutor = await getTutorBySlug((await params).slug);
  return { title: tutor?.fullName ?? "Tutor" };
}

export default async function TutorProfile({ params }: PageProps<"/tutors/[slug]">) {
  const tutor = await getTutorBySlug((await params).slug);
  if (!tutor) notFound();
  const [reviews, subjects, grades, languages] = await Promise.all([
    getPublishedReviews(tutor.id),
    getSubjects(),
    getGrades(),
    getLanguages(),
  ]);
  const subjectName = new Map(subjects.map((s) => [s.code, s.name]));
  const gradeName = new Map(grades.map((g) => [g.code, g.name]));
  const languageName = new Map(languages.map((l) => [l.code, l.name]));

  // Group what they teach by subject, listing the grades and the languages
  // each is taught in — the three facts are distinct (see the 4NF audit).
  const bySubject = new Map<string, { grades: string[]; media: Set<string> }>();
  for (const c of tutor.competencies) {
    const name = subjectName.get(c.subjectCode) ?? c.subjectCode;
    const entry = bySubject.get(name) ?? { grades: [], media: new Set<string>() };
    const gradeLabel = gradeName.get(c.gradeCode);
    if (gradeLabel) entry.grades.push(gradeLabel);
    for (const code of c.mediaLanguageCodes) {
      const label = languageName.get(code);
      if (label) entry.media.add(label);
    }
    bySubject.set(name, entry);
  }
  const spokenLanguages = tutor.spokenLanguageCodes.flatMap((code) => {
    const label = languageName.get(code);
    return label ? [label] : [];
  });

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
      <PageHeading title={tutor.fullName} description={tutor.headline} />
      {tutor.reviewCount ? <Rating rating={tutor.rating ?? 0} count={tutor.reviewCount} /> : null}

      {tutor.bio ? (
        <Card>
          <CardTitle>About</CardTitle>
          <p className="text-[14px] leading-[1.6] text-muted">{tutor.bio}</p>
        </Card>
      ) : null}

      <Card>
        <CardTitle>What {tutor.fullName.split(" ")[0]} teaches</CardTitle>
        {bySubject.size === 0 ? (
          <p className="text-[14px] text-muted">Not recorded yet.</p>
        ) : (
          [...bySubject.entries()].map(([subject, { grades, media }]) => (
            <div key={subject} className="flex flex-col gap-1 border-t border-line pt-3 first:border-0 first:pt-0">
              <p className="text-[14px] font-bold text-ink">{subject}</p>
              <p className="text-[13px] text-muted">{grades.join(", ")}</p>
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
              value={`${q.institution}${q.yearAwarded ? ` · ${q.yearAwarded}` : ""}`}
            />
          ))}
        </Card>
      ) : null}

      {spokenLanguages.length > 0 ? (
        <Card>
          <CardTitle>Speaks</CardTitle>
          <p className="text-[14px] text-muted">{spokenLanguages.join(", ")}</p>
          <p className="text-[12px] text-muted">For parent meetings and messages.</p>
        </Card>
      ) : null}

      {reviews.length > 0 ? (
        <Card>
          <CardTitle>What parents say</CardTitle>
          {reviews.map((r) => (
            <div key={r.id} className="flex flex-col gap-1 border-t border-line pt-3 first:border-0 first:pt-0">
              <Rating rating={r.rating} count={0} />
              <p className="text-[14px] text-muted">{r.comment}</p>
              <p className="text-[12px] text-muted">{r.publishedAt ? shortDate(r.publishedAt) : ""}</p>
            </div>
          ))}
        </Card>
      ) : null}

      <Card>
        <CardTitle>Request this tutor</CardTitle>
        <p className="text-[14px] text-muted">
          Choose a package and name {tutor.fullName.split(" ")[0]} as your preferred tutor. The centre will
          confirm placement based on the timetable.
        </p>
        <ButtonLink href={`/enrol?tutor=${tutor.slug}`} className="w-fit">
          Start enrolment
        </ButtonLink>
      </Card>
    </div>
  );
}
