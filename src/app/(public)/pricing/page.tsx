import type { Metadata } from "next";
import { ButtonLink, Card, CardTitle, PageHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  { title: "Pay as you go", price: "$35–$65 / hour", body: "Book lessons when you need them", cta: "Browse tutors" },
  { title: "5-lesson pack", price: "Save 8%", body: "Ideal for short-term goals", cta: "Choose package" },
  { title: "10-lesson pack", price: "Save 15%", body: "Best value for weekly learning", cta: "Choose package" },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading title="Simple, flexible pricing" description="Pay as you learn or save with lesson packages." />
      <div className="flex flex-col gap-4 md:flex-row">
        {PLANS.map((p) => (
          <Card key={p.title} className="flex-1">
            <CardTitle>{p.title}</CardTitle>
            <p className="text-[24px] text-black">{p.price}</p>
            <p className="text-[12px] text-muted">{p.body}</p>
            <ButtonLink href="/tutors" className="w-fit">
              {p.cta}
            </ButtonLink>
          </Card>
        ))}
      </div>
      <Card>
        <CardTitle>Included with every booking</CardTitle>
        <p className="text-[12px] leading-[1.7] text-black">
          Free 20-minute trial with participating tutors · Secure checkout · 24-hour rescheduling · Family and
          multi-subject discounts available
        </p>
      </Card>
    </div>
  );
}
