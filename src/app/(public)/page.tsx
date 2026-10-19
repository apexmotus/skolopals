import Image from "next/image";
import Link from "next/link";
import { Badge, ButtonLink, Card, Select } from "@/components/ui";
import { PublicFooter } from "@/components/public-nav";
import { TutorCard } from "@/components/tutor-card";
import { GRADES, SUBJECTS, searchTutors } from "@/lib/queries";

const STEPS = [
  { title: "1. Share your goals", body: "Tell us the subject, level and what you want to improve." },
  { title: "2. Meet your tutor", body: "Compare verified tutors and book a time that suits you." },
  { title: "3. Learn and progress", body: "Track lessons, reports and resources in one place." },
];

export default async function HomePage() {
  const { tutors } = await searchTutors({ sort: "rating" });
  const featured = tutors.slice(0, 2);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <section className="flex flex-col gap-8 bg-subtle p-6 md:h-[300px] md:flex-row md:p-9">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-[18px]">
          <Badge>Trusted tutors, personal progress</Badge>
          <h1 className="text-[34px] font-extrabold leading-[1.08] text-black md:text-[42px]">
            Learning that clicks, with tutors who care.
          </h1>
          <p className="text-[15px] text-muted">Find verified one-to-one tutors for every subject and stage.</p>
          <div className="flex flex-wrap gap-[10px]">
            <ButtonLink href="/tutors">Find a Tutor</ButtonLink>
            <ButtonLink href="/become-a-tutor" variant="secondary">
              Become a Tutor
            </ButtonLink>
          </div>
        </div>
        <div className="relative h-[220px] shrink-0 overflow-hidden rounded-2xl md:h-full md:w-[420px]">
          <Image
            src="/images/hero.jpg"
            alt="A student smiling during an online lesson with her tutor"
            fill
            priority
            sizes="(min-width: 768px) 420px, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <form action="/tutors" className="flex flex-col gap-[10px] bg-white p-6 md:flex-row md:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <label htmlFor="home-subject" className="text-[11px] text-ink">
            Subject
          </label>
          <input
            id="home-subject"
            name="subject"
            list="home-subjects"
            placeholder="e.g. Mathematics"
            className="h-[42px] w-full rounded-[6px] border border-line bg-white px-3 text-[13px] text-ink placeholder:text-muted"
          />
          <datalist id="home-subjects">
            {SUBJECTS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <label htmlFor="home-grade" className="text-[11px] text-ink">
            Grade
          </label>
          <Select id="home-grade" name="grade" defaultValue="">
            <option value="">Select grade</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </div>
        <button className="h-[38px] shrink-0 self-start rounded-[6px] border border-line bg-brand px-[18px] text-[13px] text-white md:mb-[2px] md:self-auto">
          Search tutors
        </button>
      </form>

      <div className="flex flex-col gap-5 p-0 md:p-7">
        <h2 className="text-[28px] text-ink">How Skolopals works</h2>
        <div className="flex flex-col gap-[14px] md:flex-row">
          {STEPS.map((s) => (
            <Card key={s.title} className="flex-1">
              <p className="text-[12px] font-bold text-black">{s.title}</p>
              <p className="text-[12px] text-muted">{s.body}</p>
            </Card>
          ))}
        </div>

        <h2 className="text-[28px] text-ink">Featured tutors</h2>
        <div className="flex flex-col gap-[14px] md:flex-row">
          {featured.map((t) => (
            <TutorCard key={t.id} tutor={t} />
          ))}
        </div>

        <h2 id="subjects" className="text-[28px] text-ink">
          Explore subjects
        </h2>
        <p className="text-[12px] text-black">
          {["Mathematics", "English", "Science", "Languages", "Computing", "Exam preparation"].map((s, i, all) => (
            <span key={s}>
              <Link href={`/tutors?subject=${encodeURIComponent(s)}`} className="hover:text-brand hover:underline">
                {s}
              </Link>
              {i < all.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>

        <Card>
          <h2 className="text-[20px] font-bold text-ink">What families say</h2>
          <p className="text-[12px] text-black">“The right tutor changed how confident Sam feels at school.” — Helena, parent</p>
        </Card>

        <div className="flex flex-col items-start justify-between gap-4 rounded-[10px] bg-night p-6 sm:flex-row sm:items-center">
          <p className="text-[22px] font-bold text-white">Ready to make progress?</p>
          <ButtonLink href="/tutors">Find your tutor</ButtonLink>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
