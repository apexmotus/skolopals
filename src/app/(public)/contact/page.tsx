import type { Metadata } from "next";
import { Card, CardTitle, PageHeading } from "@/components/ui";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading title="How can we help?" description="Our support team replies within one business day." />
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <ContactForm />
        <Card className="w-full shrink-0 md:w-[320px]">
          <CardTitle>Contact details</CardTitle>
          <div className="text-[12px] leading-[1.8] text-black">
            <p>
              <a href="mailto:support@skolopals.com" className="hover:text-brand hover:underline">
                support@skolopals.com
              </a>
            </p>
            <p>Mon–Fri, 8:00–18:00</p>
            <p>Response time: under 1 business day</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
