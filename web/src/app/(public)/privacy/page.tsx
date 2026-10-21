import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle, DataTable, PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { CENTRE, CENTRE_ADDRESS } from "@/lib/centre";
import { POLICY_VERSION } from "@/lib/consent";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How Skolopals Tutoring Centre handles personal information under POPIA, including children's information.",
};

/**
 * Part A of docs/POPIA-policy.md. Kept in step with that document by hand;
 * the consent wording itself is read from the database so the notice and
 * the enrolment form can never disagree about what was agreed to.
 */
export default async function PrivacyPage() {
  const supabase = await createClient();
  const [{ data: consentTypes }, { data: retention }] = await Promise.all([
    supabase.from("consent_types").select("*").order("sort_order"),
    supabase.from("data_retention_policies").select("*").order("record_class"),
  ]);

  return (
    <div className="flex max-w-[820px] flex-col gap-5 p-4 md:p-7">
      <PageHeading
        title="Privacy notice"
        description="How we handle your family's personal information, under the Protection of Personal Information Act 4 of 2013."
      />

      <Card>
        <CardTitle>Who we are</CardTitle>
        <p className="text-[13px] leading-[1.7] text-black">
          {CENTRE.name} is an after-school education support centre at {CENTRE_ADDRESS}. We are the{" "}
          <strong>responsible party</strong> for the personal information described here.
        </p>
        <p className="text-[13px] leading-[1.7] text-black">
          <strong>Information Officer:</strong> {CENTRE.informationOfficer}
          <br />
          <strong>Phone:</strong>{" "}
          <a href={CENTRE.phoneLink} className="text-brand hover:underline">
            {CENTRE.phone}
          </a>
          <br />
          <strong>Address:</strong> {CENTRE_ADDRESS}
        </p>
      </Card>

      <Card>
        <CardTitle>Your child&rsquo;s information, and your permission</CardTitle>
        <p className="text-[13px] leading-[1.7] text-black">
          Most of the people we hold information about are children. Section 35 of POPIA prohibits
          processing a child&rsquo;s personal information <strong>unless a parent or legal guardian has
          consented</strong>.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[13px] leading-[1.6] text-black">
          <li>
            We will not register a learner, run an assessment, or place a child in a class until you have
            given consent. Our system refuses to activate an enrolment without it.
          </li>
          <li>
            Consent is asked for <strong>separately for each purpose</strong>. You can agree to the
            tutoring and decline, for example, the use of your child&rsquo;s photograph, and your child is
            enrolled exactly the same way.
          </li>
          <li>
            You may <strong>withdraw consent at any time</strong> in writing to our Information Officer.
          </li>
          <li>
            Where an older learner is given their own login, your consent is still what makes the
            processing lawful. Their account shows their timetable, their reports and their messages —
            nothing about brothers or sisters, and nothing about fees.
          </li>
        </ul>
      </Card>

      <Card>
        <CardTitle>What we ask you to agree to</CardTitle>
        <div className="flex flex-col gap-3">
          {(consentTypes ?? []).map((c) => (
            <div key={c.code} className="flex flex-col gap-1 border-t border-line pt-3 first:border-0 first:pt-0">
              <p className="text-[13px] font-bold text-ink">
                {c.name}{" "}
                <span className={c.is_required ? "font-normal text-danger" : "font-normal text-muted"}>
                  {c.is_required ? "Required" : "Optional"}
                </span>
              </p>
              <p className="text-[12px] leading-[1.6] text-muted">{c.description}</p>
              {c.statute_ref ? <p className="text-[11px] text-muted">{c.statute_ref}</p> : null}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted">
          Declining an optional consent does not affect your child&rsquo;s place. This notice is version{" "}
          {POLICY_VERSION}; each consent records the version it was given under.
        </p>
      </Card>

      <Card>
        <CardTitle>Health information</CardTitle>
        <p className="text-[13px] leading-[1.7] text-black">
          Allergies and medical conditions are <strong>special personal information</strong> under section
          26 of POPIA. We collect them only so we can look after your child safely on our premises.
        </p>
        <p className="text-[13px] leading-[1.7] text-black">
          Health information is visible <strong>only to the centre manager and administrators</strong>.
          Tutors are not given access to it through our system. Where a tutor must know something to keep
          a child safe during a session, the centre manager tells them directly.
        </p>
      </Card>

      <Card>
        <CardTitle>Who sees what</CardTitle>
        <p className="text-[13px] leading-[1.7] text-black">
          These limits are enforced by our database, not only by what each screen chooses to show.
        </p>
        <DataTable
          rows={[
            { who: "You", sees: "Your own children: attendance, assessments, reports, invoices and messages" },
            { who: "Your child's tutor", sees: "Their name, grade, academic records and attendance — not your fees, not their health notes" },
            { who: "The centre manager", sees: "Everything, including health notes and collection arrangements" },
            { who: "Another parent", sees: "Nothing about your family at all" },
            { who: "A visitor to this site", sees: "Our tutors, fees, timetable and programmes. No learner information" },
          ]}
          rowKey={(r) => r.who}
          columns={[
            { header: "Who", cell: (r) => r.who, primary: true },
            { header: "What they can see", cell: (r) => r.sees },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>Your information leaves South Africa</CardTitle>
        <p className="text-[13px] leading-[1.7] text-black">
          Our systems are hosted in <strong>London, United Kingdom</strong>, so your and your child&rsquo;s
          information is stored outside South Africa. Section 72 of POPIA permits this where the recipient
          is bound to protection substantially similar to POPIA, which the United Kingdom&rsquo;s regime and
          our agreement with our hosting provider meet.
        </p>
        <p className="text-[13px] leading-[1.7] text-black">
          If you would prefer your child&rsquo;s information not to leave South Africa, speak to our
          Information Officer and we will tell you honestly what we can and cannot offer.
        </p>
      </Card>

      <Card>
        <CardTitle>How long we keep it</CardTitle>
        <DataTable
          rows={retention ?? []}
          rowKey={(r) => r.record_class}
          columns={[
            { header: "Records", cell: (r) => r.description, primary: true },
            {
              header: "Kept for",
              cell: (r) =>
                r.retention_months % 12 === 0
                  ? `${r.retention_months / 12} year(s)`
                  : `${r.retention_months} months`,
            },
          ]}
        />
        <p className="text-[11px] text-muted">
          After that we delete the records, or anonymise them so no one can be identified. Financial
          records are kept five years because the South African Revenue Service requires it.
        </p>
      </Card>

      <Card>
        <CardTitle>Your rights</CardTitle>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-[1.6] text-black">
          <li>Ask what we hold about you or your child, and get a copy</li>
          <li>Correct or delete anything wrong, misleading or out of date</li>
          <li>Object to processing, and withdraw any consent</li>
          <li>Opt out of marketing messages, on any message</li>
          <li>Complain to us, and then to the Information Regulator</li>
        </ul>
        <p className="text-[13px] leading-[1.7] text-black">
          Write to our Information Officer or call {CENTRE.phone}. We respond within{" "}
          <strong>30 days</strong>. There is no charge to ask what we hold.
        </p>
      </Card>

      <Card>
        <CardTitle>Complaining to the Regulator</CardTitle>
        <p className="text-[13px] leading-[1.7] text-black">
          If you are not satisfied with our response you may complain to the Information Regulator (South
          Africa), JD House, 27 Stiemens Street, Braamfontein, Johannesburg.
        </p>
        <p className="text-[12px] text-muted">
          See also our{" "}
          <Link href="/safeguarding" className="text-brand hover:underline">
            safeguarding page
          </Link>{" "}
          for how we keep children safe on the premises.
        </p>
      </Card>
    </div>
  );
}
