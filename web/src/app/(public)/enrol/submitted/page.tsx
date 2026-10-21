import type { Metadata } from "next";
import { ButtonLink, Card, CardTitle, PageHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Enrolment received" };

export default function SubmittedPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading
        title="Thank you — we have your enrolment"
        description="The centre will be in touch to arrange your child’s initial assessment."
      />
      <Card className="max-w-[640px]">
        <CardTitle>What happens next</CardTitle>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px] leading-[1.6] text-black">
          <li>We review your enrolment and contact you to arrange an initial assessment.</li>
          <li>The assessment sets your child’s starting level and we draw up a learning plan.</li>
          <li>We place your child in a class and confirm the timetable with you.</li>
          <li>Your registration invoice is issued when the place is confirmed.</li>
        </ol>
        <ButtonLink href="/parent" className="w-fit">
          Go to your portal
        </ButtonLink>
      </Card>
    </div>
  );
}
