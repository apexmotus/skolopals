import type { Metadata } from "next";
import { ButtonLink, StatusState } from "@/components/ui";

export const metadata: Metadata = { title: "Application submitted" };

export default function ApplicationSubmittedPage() {
  return (
    <div className="p-4 md:p-7">
      <StatusState
        icon="/icons/check-circle.svg"
        title="Application submitted"
        description="We’ve received your details. Verification usually takes 3–5 business days."
      >
        <ButtonLink href="/tutor/application">View application status</ButtonLink>
      </StatusState>
    </div>
  );
}
