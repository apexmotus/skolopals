import Link from "next/link";
import Image from "next/image";
import { Badge, ButtonLink, Card, CardTitle } from "@/components/ui";
import { PublicFooter } from "@/components/public-nav";
import { TutorCard } from "@/components/tutor-card";
import { getPackages, getSubjectsByPhase, searchTutors } from "@/lib/queries";
import { money } from "@/lib/format";

// The plan's core value chain, section 10.
const CHAIN = [
  { title: "1. Assessment", body: "Every learner starts with an assessment of reading, writing and mathematics." },
  { title: "2. Learning plan", body: "We set goals per subject from what the assessment shows." },
  { title: "3. Tutoring & homework", body: "Small groups at the centre, Monday to Thursday and Saturday mornings." },
  { title: "4. Reports & feedback", body: "Monthly monitoring, a termly report, and a conversation with you." },
];

export default async function HomePage() {
  const [tutors, phases, packages] = await Promise.all([
    searchTutors(),
    getSubjectsByPhase(),
    getPackages(),
  ]);
  const featured = tutors.slice(0, 3);
  const fromPrice = packages.find((p) => p.code === "group_1")?.amount_cents;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <section className="flex flex-col gap-8 bg-subtle p-6 md:h-[300px] md:flex-row md:p-9">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-[18px]">
          <Badge>Damonsville · Brits · North West</Badge>
          <h1 className="text-[34px] font-extrabold leading-[1.08] text-black md:text-[42px]">
            Learning Today. Succeeding Tomorrow.
          </h1>
          <p className="text-[15px] text-muted">
            Affordable after-school tutoring, homework support and reading intervention for Grade R to Grade 12,
            following the CAPS curriculum.
          </p>
          <div className="flex flex-wrap gap-[10px]">
            <ButtonLink href="/enrol">Enrol a learner</ButtonLink>
            <ButtonLink href="/pricing" variant="secondary">
              See our fees
            </ButtonLink>
          </div>
        </div>
        <div className="relative h-[220px] shrink-0 overflow-hidden rounded-2xl md:h-full md:w-[420px]">
          <Image
            src="/images/hero.jpg"
            alt="A learner working with a tutor at the centre"
            fill
            priority
            sizes="(min-width: 768px) 420px, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <div className="flex flex-col gap-5 p-0 md:p-7">
        <h2 className="text-[28px] text-ink">How Skolopals works</h2>
        <div className="grid gap-[14px] md:grid-cols-4">
          {CHAIN.map((s) => (
            <Card key={s.title}>
              <p className="text-[12px] font-bold text-black">{s.title}</p>
              <p className="text-[12px] text-muted">{s.body}</p>
            </Card>
          ))}
        </div>

        {fromPrice ? (
          <Card>
            <CardTitle>Small groups, from {money(fromPrice)} a month</CardTitle>
            <p className="text-[12px] text-black">
              One subject, two subjects, three, or all-subject support. Homework assistance and one-on-one
              tutoring are available too.{" "}
              <Link href="/pricing" className="text-brand hover:underline">
                See the full price list
              </Link>
              .
            </p>
          </Card>
        ) : null}

        {featured.length > 0 ? (
          <>
            <h2 className="text-[28px] text-ink">Our tutors</h2>
            <div className="grid gap-[14px] md:grid-cols-3">
              {featured.map((t) => (
                <TutorCard key={t.id} tutor={t} />
              ))}
            </div>
          </>
        ) : null}

        <h2 id="subjects" className="text-[28px] text-ink">
          What we teach
        </h2>
        <div className="grid gap-[14px] md:grid-cols-4">
          {phases.map((p) => (
            <Card key={p.code}>
              <p className="text-[12px] font-bold text-black">{p.name}</p>
              <p className="text-[12px] text-muted">{p.subjects.join(" · ")}</p>
            </Card>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 rounded-[10px] bg-night p-6 sm:flex-row sm:items-center">
          <p className="text-[22px] font-bold text-white">Ready to get started?</p>
          <ButtonLink href="/enrol">Enrol a learner</ButtonLink>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
