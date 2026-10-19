import type { Metadata } from "next";
import { ButtonLink, StatusState } from "@/components/ui";

export const metadata: Metadata = { title: "Tutor approved" };

export default function ApprovedPage() {
  return (
    <StatusState
      icon="/icons/check-circle.svg"
      title="Tutor approved"
      description="Their profile is now live in the marketplace and they’ve been notified in their workspace."
    >
      <ButtonLink href="/admin/applications">Back to applications</ButtonLink>
    </StatusState>
  );
}
