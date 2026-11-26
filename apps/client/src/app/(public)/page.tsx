import Link from "next/link";
import Image from "next/image";
import { ButtonLink, Card } from "@skolopals/ui/ui";
import { PublicFooter } from "@/components/public-nav";
import { TutorCard } from "@/components/tutor-card";
import { formatRandSpaced } from "@skolopals/shared/format";
import { getPackages, getSubjectsByPhase, searchTutors } from "@/lib/queries";
import { getRecruitmentStatus } from "@/lib/tutor-applications";
import { shortDate } from "@skolopals/shared/format";

// The plan's core value chain, styled per the UI redesign specification.
const CHAIN = [
  {
    title: "1. Assessment",
    body: "Every learner starts with an assessment of reading, writing and mathematics.",
    accentClass: "border-t-[#D81B7A]",
  },
  {
    title: "2. Learning plan",
    body: "We set goals per subject from what the assessment shows.",
    accentClass: "border-t-[#0288D1]",
  },
  {
    title: "3. Tutoring & homework",
    body: "Small groups at the centre, Monday to Thursday and Saturday mornings.",
    accentClass: "border-t-[#FBC02D]",
  },
  {
    title: "4. Reports & feedback",
    body: "Monthly monitoring, a termly report, and a conversation with you.",
    accentClass: "border-t-[#7B1FA2]",
  },
] as const;

export default async function HomePage() {
  const [tutors, phases, packages, recruitment] = await Promise.all([
    searchTutors(),
    getSubjectsByPhase(),
    getPackages(),
    getRecruitmentStatus(),
  ]);
  const featured = tutors.slice(0, 3);
  const fromPriceCents = packages.find((p) => p.code === "group_1")?.amountCents;
  const fromPriceText = formatRandSpaced(fromPriceCents);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col px-4 md:px-[24px]">
      {/* 4.2 Hero Banner Section */}
      <section className="relative mt-[24px] overflow-hidden rounded-[20px] border border-line bg-[linear-gradient(135deg,#3a1658_0%,#2a1040_60%,#24103a_100%)] px-6 py-9 md:px-[56px] md:py-[48px]">
        <div className="relative z-10 grid grid-cols-1 items-center gap-[40px] md:grid-cols-[1.25fr_0.75fr]">
          {/* Left Column (Copy & CTAs) */}
          <div className="flex min-w-0 flex-col items-start">
            <span className="mb-[20px] inline-flex items-center rounded-[9999px] bg-white/10 px-[14px] py-[6px] text-[12px] font-semibold leading-none tracking-[0.01em] text-ink">
              Damonsville · Brits · North West
            </span>
            <h1 className="mb-[16px] text-[42px] font-extrabold leading-[1.15] tracking-[-0.02em]">
              <span className="text-white">Learning Today. </span>
              <span className="text-brand-light">Succeeding Tomorrow.</span>
            </h1>
            <p className="mb-[28px] max-w-[580px] text-[16px] font-medium leading-[1.5] tracking-[0] text-muted">
              Affordable after-school tutoring, homework support and reading intervention for Grade R to Grade 12,
              following the CAPS curriculum.
            </p>
            <div className="flex flex-wrap items-center gap-[14px]">
              <Link
                href="/enrol"
                className="inline-flex items-center justify-center rounded-[8px] bg-[#D81B7A] px-[24px] py-[12px] text-[14px] font-bold leading-none text-[#FFFFFF] transition-colors hover:bg-[#be166b]"
              >
                Enrol a learner
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-[8px] border-[1.5px] border-white/40 bg-transparent px-[24px] py-[12px] text-[14px] font-bold leading-none text-ink transition-colors hover:bg-white/[0.06]"
              >
                See our fees
              </Link>
              {/* Only while the centre has tutor applications open (SPEC-2026-11-tutor-applications.md §3.1). */}
              {recruitment.isOpen ? (
                <Link
                  href="/teach"
                  className="inline-flex items-center justify-center rounded-[8px] border-[1.5px] border-white/40 bg-transparent px-[24px] py-[12px] text-[14px] font-bold leading-none text-ink transition-colors hover:bg-white/[0.06]"
                >
                  Apply to teach
                </Link>
              ) : null}
            </div>
          </div>

          {/* Right Column (Hero Image + Hand-Drawn Accents) */}
          <div className="relative mx-auto w-full">
            {/* Top-Left Corner Decorative Burst Lines (#D81B7A: -45deg, -20deg, -70deg) */}
            <svg
              aria-hidden="true"
              viewBox="0 0 40 40"
              fill="none"
              className="pointer-events-none absolute -top-[28px] -left-[28px] z-20 size-[40px]"
            >
              {/* -45deg stroke */}
              <line x1="27.8" y1="27.8" x2="15" y2="15" stroke="#D81B7A" strokeWidth="4" strokeLinecap="round" />
              {/* -20deg stroke */}
              <line x1="24.5" y1="29.3" x2="8.5" y2="23.5" stroke="#D81B7A" strokeWidth="4" strokeLinecap="round" />
              {/* -70deg stroke */}
              <line x1="29.3" y1="24.5" x2="23.5" y2="8.5" stroke="#D81B7A" strokeWidth="4" strokeLinecap="round" />
            </svg>

            {/* Photo Frame */}
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[16px] shadow-[0_10px_25px_rgba(27,37,89,0.08)]">
              <Image
                src="/images/hero.jpg"
                alt="A learner working with a tutor at the centre"
                fill
                priority
                sizes="(min-width: 768px) 440px, 100vw"
                className="object-cover"
              />
            </div>

            {/* Bottom-Right Corner Decorative Burst Lines (#FBC02D) */}
            <svg
              aria-hidden="true"
              viewBox="0 0 40 40"
              fill="none"
              className="pointer-events-none absolute -right-[28px] -bottom-[28px] z-20 size-[40px]"
            >
              {/* -45deg opposite stroke */}
              <line x1="12.2" y1="12.2" x2="25" y2="25" stroke="#FBC02D" strokeWidth="4" strokeLinecap="round" />
              {/* -20deg opposite stroke */}
              <line x1="15.5" y1="10.7" x2="31.5" y2="16.5" stroke="#FBC02D" strokeWidth="4" strokeLinecap="round" />
              {/* -70deg opposite stroke */}
              <line x1="10.7" y1="15.5" x2="16.5" y2="31.5" stroke="#FBC02D" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Bottom Organic Wave Layers (#F8D7E8 left into #FCF3CF right) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1280 45"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[45px] w-full"
        >
          <path
            d="M0,18 C240,42 520,-4 820,26 C1020,44 1160,22 1280,14 L1280,45 L0,45 Z"
            fill="#d81b7a"
            fillOpacity="0.16"
          />
          <path
            d="M360,45 C580,14 860,6 1080,24 C1180,32 1240,20 1280,12 L1280,45 Z"
            fill="#f5c211"
            fillOpacity="0.14"
          />
        </svg>
      </section>

      {/* 4.3 "How Skolopals works" Process Grid */}
      <section className="mt-[40px]">
        <h2 className="mb-[20px] text-[28px] font-extrabold leading-[1.25] tracking-[-0.015em] text-ink">
          How Skolopals works
        </h2>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {CHAIN.map((s) => (
            <div
              key={s.title}
              className={`relative flex flex-col gap-2 overflow-hidden rounded-[12px] border border-line border-t-[4px] bg-surface px-[22px] pt-[20px] pb-[24px] ${s.accentClass}`}
            >
              <h3 className="text-[16px] font-bold leading-[1.35] text-ink">{s.title}</h3>
              <p className="text-[14px] font-normal leading-[1.5] text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4.4 Full-Width Pricing Callout Banner */}
      <section className="mt-[24px] w-full rounded-[12px] border border-line border-l-[4px] border-l-sun bg-plum-800 px-[28px] py-[22px]">
        <h2 className="mb-[6px] text-[22px] font-extrabold leading-[1.3] tracking-[-0.01em] text-ink">
          Small groups, from <span className="text-sun">{fromPriceText}</span> a month
        </h2>
        <p className="text-[14px] font-normal leading-[1.5] text-muted">
          One subject, two subjects, three, or all-subject support. Homework assistance and one-on-one tutoring are
          available too.{" "}
          <Link href="/pricing" className="font-semibold text-link no-underline hover:underline">
            See the full price list.
          </Link>
        </p>
      </section>

      {/* 4.5 Subsequent Section Header: "What we teach" */}
      <section className="mt-[36px]">
        <h2
          id="subjects"
          className="mb-[20px] text-[28px] font-extrabold leading-[1.25] tracking-[-0.015em] text-ink"
        >
          What we teach
        </h2>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {phases.map((p) => (
            <Card key={p.code} className="gap-2 px-[22px] pt-[20px] pb-[24px]">
              <h3 className="text-[16px] font-bold leading-[1.35] text-ink">{p.name}</h3>
              <p className="text-[14px] font-normal leading-[1.5] text-muted">{p.subjects.join(" · ")}</p>
            </Card>
          ))}
        </div>
      </section>

      {recruitment.isOpen ? (
        <section className="mt-[40px] flex flex-col items-start justify-between gap-4 rounded-[12px] border border-line border-l-[4px] border-l-brand bg-surface px-[28px] py-[22px] md:flex-row md:items-center">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="text-[22px] font-extrabold leading-[1.3] tracking-[-0.01em] text-ink">
              We’re looking for <span className="text-brand-light">tutors</span>
            </h2>
            {recruitment.message ? (
              <p className="max-w-[640px] text-[14px] leading-[1.5] text-muted">{recruitment.message}</p>
            ) : null}
            {recruitment.needs && recruitment.needs.length > 0 ? (
              <ul aria-label="Subjects we need" className="flex flex-wrap gap-2">
                {recruitment.needs.map((n) => (
                  <li key={n.code} className="rounded-full bg-subtle px-3 py-1 text-[12px] font-semibold text-ink">
                    {n.name}
                  </li>
                ))}
              </ul>
            ) : null}
            {recruitment.closesAt ? (
              <p className="text-[12px] text-muted">Applications close {shortDate(recruitment.closesAt)}.</p>
            ) : null}
          </div>
          <ButtonLink href="/teach" variant="sun">
            Apply to teach
          </ButtonLink>
        </section>
      ) : null}

      {/* Featured Tutors */}
      {featured.length > 0 ? (
        <section className="mt-[40px]">
          <h2 className="mb-[20px] text-[28px] font-extrabold leading-[1.25] tracking-[-0.015em] text-ink">
            Our tutors
          </h2>
          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
            {featured.map((t) => (
              <TutorCard key={t.id} tutor={t} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Bottom CTA Banner */}
      <section className="mt-[40px] flex flex-col items-start justify-between gap-4 rounded-[12px] border border-plum-700 bg-plum-800 px-[28px] py-[24px] sm:flex-row sm:items-center">
        <h2 className="text-[22px] font-extrabold leading-[1.3] tracking-[-0.01em] text-white">
          Ready to get <span className="text-sun">started?</span>
        </h2>
        <ButtonLink href="/enrol" variant="sun">
          Enrol a learner
        </ButtonLink>
      </section>

      <PublicFooter />
    </div>
  );
}
