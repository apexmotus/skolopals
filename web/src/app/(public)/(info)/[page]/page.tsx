import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink, Card, PageHeading } from "@/components/ui";

// Placeholder copy for footer pages until real content is written.
const PAGES: Record<string, { title: string; description: string; body: string[] }> = {
  about: {
    title: "About Skolopals",
    description: "Learning Today. Succeeding Tomorrow.",
    body: [
      "Skolopals Tutoring Centre is a community-based education support centre in Damonsville, Brits. We provide affordable, structured academic help to learners from Grade R to Grade 12, following the CAPS curriculum.",
      "We are an after-school centre, not a replacement for school. Learners come to us for homework support, reading intervention, small-group tutoring, examination preparation and holiday revision.",
      "Every learner starts with an assessment, works to an individual learning plan, and receives a termly progress report that we discuss with their parents.",
    ],
  },
  safeguarding: {
    title: "Keeping learners safe",
    description: "How we look after the children in our care.",
    body: [
      "Learners sign in when they arrive and sign out when they leave. A child is only released to a parent, guardian or someone on the authorised collector list the family has given us.",
      "We keep emergency contact details and any allergy or medical information for every learner. That information is held by the centre manager and is not shared with tutors through the system.",
      "Our tutors provide identity documents, qualification certificates, references and a police clearance before they teach. To raise a concern, please contact the centre manager.",
    ],
  },
  careers: {
    title: "Work with us",
    description: "Teaching at Skolopals.",
    body: [
      "We look for tutors with a teaching qualification or a strong academic background, knowledge of CAPS, experience with children, patience and reliable references.",
      "Tutors are employed by the centre on a salary or a per-session rate. We do not take a share of what families pay.",
      "We do not have an online application. If you would like to teach with us, please get in touch through the contact page.",
    ],
  },
  terms: {
    title: "Terms and conditions",
    description: "The agreement between Skolopals and your family.",
    body: [
      "Fees are invoiced monthly, in advance. An invoice is issued on the 15th for the following month and is due on the 1st.",
      "A late payment fee applies after a three-day grace period. Invoices, payments and your running balance are visible in your parent portal at any time.",
      "Our full written terms, including the payment policy and notice periods, are provided when your learner is registered.",
    ],
  },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PAGES).map((page) => ({ page }));
}

export async function generateMetadata({ params }: PageProps<"/[page]">): Promise<Metadata> {
  return { title: PAGES[(await params).page]?.title };
}

export default async function InfoPage({ params }: PageProps<"/[page]">) {
  const page = PAGES[(await params).page];
  if (!page) notFound();
  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading title={page.title} description={page.description} />
      <Card className="max-w-[760px]">
        {page.body.map((p) => (
          <p key={p} className="text-[13px] leading-[1.6] text-black">
            {p}
          </p>
        ))}
        <ButtonLink href="/contact" variant="secondary" className="w-fit">
          Contact us
        </ButtonLink>
      </Card>
    </div>
  );
}
