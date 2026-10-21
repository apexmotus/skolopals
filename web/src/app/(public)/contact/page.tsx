import type { Metadata } from "next";
import { Card, CardTitle, PageHeading } from "@/components/ui";
import { ContactForm } from "./contact-form";
import { getOperatingHours } from "@/lib/queries";
import { CENTRE } from "@/lib/centre";
import { clockTime, dayName } from "@/lib/format";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const hours = await getOperatingHours();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading
        title="Get in touch"
        description="Come and see us, call, or send a message and we will come back to you."
      />
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <ContactForm />
        <div className="flex w-full shrink-0 flex-col gap-4 md:w-[320px]">
          <Card>
            <CardTitle>Find us</CardTitle>
            <div className="text-[13px] leading-[1.8] text-black">
              <p>{CENTRE.addressLine}</p>
              <p>
                {CENTRE.town}, {CENTRE.province}
              </p>
              <p className="pt-2">
                <a href={CENTRE.phoneLink} className="text-brand hover:underline">
                  {CENTRE.phone}
                </a>
              </p>
              <p>
                <a href={CENTRE.whatsappLink} className="text-brand hover:underline">
                  Message us on WhatsApp
                </a>
              </p>
            </div>
          </Card>

          <Card>
            <CardTitle>When we are open</CardTitle>
            <ul className="flex flex-col gap-1">
              {hours.map((h) => (
                <li key={`${h.day_of_week}-${h.opens_at}`} className="flex justify-between gap-3 text-[12px]">
                  <span className="text-muted">{dayName(h.day_of_week)}</span>
                  <span className="text-ink">
                    {clockTime(h.opens_at)}–{clockTime(h.closes_at)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted">
              Friday is set aside for tests, catch-up lessons and parent meetings.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
