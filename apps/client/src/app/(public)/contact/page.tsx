import type { Metadata } from "next";
import { Card, CardTitle, PageHeading } from "@skolopals/ui/ui";
import { ContactForm } from "./contact-form";
import { getOperatingHours } from "@/lib/queries";
import { CENTRE } from "@/lib/centre";
import { clockTime, dayName } from "@skolopals/shared/format";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const hours = await getOperatingHours();

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
      <PageHeading
        title="Get in touch"
        description="Come and see us, call, or send a message and we will come back to you."
      />
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <ContactForm />
        <div className="flex w-full shrink-0 flex-col gap-4 md:w-[320px]">
          <Card>
            <CardTitle>Find us</CardTitle>
            <div className="text-[14px] leading-[1.8] text-muted">
              <p>{CENTRE.addressLine}</p>
              <p>
                {CENTRE.town}, {CENTRE.province}
              </p>
              <p className="pt-2">
                <a href={CENTRE.phoneLink} className="font-semibold text-link hover:underline">
                  {CENTRE.phone}
                </a>
              </p>
              <p>
                <a href={CENTRE.whatsappLink} className="font-semibold text-link hover:underline">
                  Message us on WhatsApp
                </a>
              </p>
            </div>
          </Card>

          <Card>
            <CardTitle>When we are open</CardTitle>
            <ul className="flex flex-col gap-1">
              {hours.map((h) => (
                <li key={`${h.dayOfWeek}-${h.opensAt}`} className="flex justify-between gap-3 text-[12px]">
                  <span className="text-muted">{dayName(h.dayOfWeek)}</span>
                  <span className="text-ink">
                    {clockTime(h.opensAt)}–{clockTime(h.closesAt)}
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
