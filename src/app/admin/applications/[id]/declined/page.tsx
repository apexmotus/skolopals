import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Application declined" };

export default function DeclinedPage() {
  return (
    <div className="flex min-h-[560px] flex-col items-center justify-center gap-4 text-center">
      <img src="/icons/status-circle.svg" alt="" width={72} height={72} />
      <AlertCircle aria-hidden size={32} strokeWidth={1} className="text-muted" />
      <h1 className="text-[28px] text-black">Application declined</h1>
      <p className="max-w-[520px] text-[12px] leading-[1.5] text-muted">
        The applicant has been notified with your note. They can reapply with updated documents.
      </p>
      <ButtonLink href="/admin/applications">Back to applications</ButtonLink>
    </div>
  );
}
