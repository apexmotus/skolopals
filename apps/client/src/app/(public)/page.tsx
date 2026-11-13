import Link from "next/link";
import Image from "next/image";
import { ButtonLink, Card } from "@skolopals/ui/ui";
import { PublicFooter } from "@/components/public-nav";
import { TutorCard } from "@/components/tutor-card";
import { formatRandSpaced } from "@skolopals/shared/format";
import { getPackages, getSubjectsByPhase, searchTutors } from "@/lib/queries";

// The plan's core value chain, styled per the UI redesign specification.
const CHAIN = [
  {
    title: "1. Assessment",
    body: "Every learner starts with an assessment of reading, writing and mathematics.",
    accentClass: "border-t-[#D81B7A] bg-[linear-gradient(180deg,#FDF2F8_0%,#FCE7F3_100%)]",
  },
  {
    title: "2. Learning plan",
    body: "We set goals per subject from what the assessment shows.",
    accentClass: "border-t-[#0288D1] bg-[linear-gradient(180deg,#F0F8FF_0%,#E0F2FE_100%)]",
  },
  {
    title: "3. Tutoring & homework",
    body: "Small groups at the centre, Monday to Thursday and Saturday mornings.",
    accentClass: "border-t-[#FBC02D] bg-[linear-gradient(180deg,#FFFDF2_0%,#FEF9C3_100%)]",
  },
  {
    title: "4. Reports & feedback",
    body: "Monthly monitoring, a termly report, and a conversation with you.",
    accentClass: "border-t-[#7B1FA2] bg-[linear-gradient(180deg,#F8F4FC_0%,#F3E8FF_100%)]",
  },
] as const;

export default async function HomePage() {
  const [tutors, phases, packages] = await Promise.all([
    searchTutors(),
    getSubjectsByPhase(),
    getPackages(),
  ]);
  const featured = tutors.slice(0, 3);
  const fromPriceCents = packages.find((p) => p.code === "group_1")?.amountCents;
  const fromPriceText = formatRandSpaced(fromPriceCents);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col px-4 md:px-[24px]">
      {/* 4.2 Hero Banner Section */}
      <section className="relative mt-[24px] overflow-hidden rounded-[20px] bg-[#EDF4FB] bg-[linear-gradient(135deg,#EEF4FA_0%,#E6EFF8_100%)] px-6 py-9 md:px-[56px] md:py-[48px]">
        <div className="relative z-10 grid grid-cols-1 items-center gap-[40px] md:grid-cols-[1.25fr_0.75fr]">
          {/* Left Column (Copy & CTAs) */}
          <div className="flex min-w-0 flex-col items-start">
            <span className="mb-[20px] inline-flex items-center rounded-[9999px] bg-[#DCE7F3] px-[14px] py-[6px] text-[12px] font-semibold leading-none tracking-[0.01em] text-[#334155]">
              Damonsville · Brits · North West
            </span>
            <h1 className="mb-[16px] text-[42px] font-extrabold leading-[1.15] tracking-[-0.02em]">
              <span style={{ color: "#1B2559" }}>Learning Today. </span>
              <span style={{ color: "#D81B7A" }}>Succeeding Tomorrow.</span>
            </h1>
            <p className="mb-[28px] max-w-[580px] text-[16px] font-medium leading-[1.5] tracking-[0] text-[#334155]">
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
                className="inline-flex items-center justify-center rounded-[8px] border-[1.5px] border-[#1B2559] bg-[rgba(255,255,255,0.7)] px-[24px] py-[12px] text-[14px] font-bold leading-none text-[#1B2559] transition-colors hover:bg-white"
              >
                See our fees
              </Link>
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
            fill="#F8D7E8"
            fillOpacity="0.85"
          />
          <path
            d="M360,45 C580,14 860,6 1080,24 C1180,32 1240,20 1280,12 L1280,45 Z"
            fill="#FCF3CF"
            fillOpacity="0.9"
          />
        </svg>
      </section>

      {/* 4.3 "How Skolopals works" Process Grid */}
      <section className="mt-[40px]">
        <h2 className="mb-[20px] text-[28px] font-extrabold leading-[1.25] tracking-[-0.015em] text-[#1B2559]">
          How Skolopals works
        </h2>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {CHAIN.map((s) => (
            <div
              key={s.title}
              className={`relative flex flex-col gap-2 overflow-hidden rounded-[12px] border border-black/[0.04] border-t-[4px] px-[22px] pt-[20px] pb-[24px] ${s.accentClass}`}
            >
              <h3 className="text-[16px] font-bold leading-[1.35] text-[#1B2559]">{s.title}</h3>
              <p className="text-[14px] font-normal leading-[1.5] text-[#334155]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4.4 Full-Width Pricing Callout Banner */}
      <section className="mt-[24px] w-full rounded-[12px] border border-[#F5E6B8] bg-[#FDF4D7] px-[28px] py-[22px]">
        <h2 className="mb-[6px] text-[22px] font-extrabold leading-[1.3] tracking-[-0.01em] text-[#1B2559]">
          Small groups, from <span className="text-[#D81B7A]">{fromPriceText}</span> a month
        </h2>
        <p className="text-[14px] font-normal leading-[1.5] text-[#334155]">
          One subject, two subjects, three, or all-subject support. Homework assistance and one-on-one tutoring are
          available too.{" "}
          <Link href="/pricing" className="font-semibold text-[#0277BD] no-underline hover:underline">
            See the full price list.
          </Link>
        </p>
      </section>

      {/* 4.5 Subsequent Section Header: "What we teach" */}
      <section className="mt-[36px]">
        <h2
          id="subjects"
          className="mb-[20px] text-[28px] font-extrabold leading-[1.25] tracking-[-0.015em] text-[#1B2559]"
        >
          What we teach
        </h2>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {phases.map((p) => (
            <Card key={p.code} className="gap-2 px-[22px] pt-[20px] pb-[24px]">
              <h3 className="text-[16px] font-bold leading-[1.35] text-[#1B2559]">{p.name}</h3>
              <p className="text-[14px] font-normal leading-[1.5] text-[#334155]">{p.subjects.join(" · ")}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured Tutors */}
      {featured.length > 0 ? (
        <section className="mt-[40px]">
          <h2 className="mb-[20px] text-[28px] font-extrabold leading-[1.25] tracking-[-0.015em] text-[#1B2559]">
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
      <section className="mt-[40px] flex flex-col items-start justify-between gap-4 rounded-[12px] bg-[#1B2559] px-[28px] py-[24px] sm:flex-row sm:items-center">
        <h2 className="text-[22px] font-extrabold leading-[1.3] tracking-[-0.01em] text-white">
          Ready to get started?
        </h2>
        <ButtonLink href="/enrol">Enrol a learner</ButtonLink>
      </section>

      <PublicFooter />
    </div>
  );
}
