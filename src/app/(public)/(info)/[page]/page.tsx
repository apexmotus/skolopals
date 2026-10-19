import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink, Card, PageHeading } from "@/components/ui";

// Placeholder copy for footer pages until real content is written.
const PAGES: Record<string, { title: string; description: string; body: string[] }> = {
  about: {
    title: "About Skolopals",
    description: "Trusted tutors, personal progress.",
    body: [
      "Skolopals connects students and families with verified one-to-one tutors for every subject and stage.",
      "Every tutor is identity-checked and reviewed by our team before their profile goes live.",
    ],
  },
  safeguarding: {
    title: "Safeguarding",
    description: "How we keep learners safe.",
    body: [
      "All tutors complete identity verification and an enhanced background check before teaching.",
      "Lessons and messages stay on Skolopals so our team can help if anything goes wrong. To raise a concern, contact support@skolopals.com.",
    ],
  },
  careers: {
    title: "Careers",
    description: "Help more learners find the right tutor.",
    body: ["We don’t have open roles right now. Interested in teaching? Apply to become a tutor."],
  },
  terms: {
    title: "Terms of service",
    description: "The rules for using Skolopals.",
    body: ["Our full terms are being finalised. Contact support@skolopals.com with any questions."],
  },
  privacy: {
    title: "Privacy policy",
    description: "How we handle your data.",
    body: ["Our full privacy policy is being finalised. Contact support@skolopals.com with any questions."],
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
