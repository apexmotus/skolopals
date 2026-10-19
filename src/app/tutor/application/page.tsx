import type { Metadata } from "next";
import { AlertCircle, Clock, FilePlus } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink, Card, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor";
import { ResubmitForm } from "./resubmit-form";

export const metadata: Metadata = { title: "Application status" };

export default async function ApplicationStatusPage() {
  const { profile, tutor } = await getTutorContext();
  const supabase = await createClient();
  const { data: app } = await supabase
    .from("tutor_applications")
    .select("*")
    .eq("user_id", profile.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!app) {
    return (
      <State icon={<FilePlus aria-hidden size={32} strokeWidth={1} className="text-muted" />} title="Finish your application" description="Tell us about your teaching background and upload your documents to get verified.">
        <ButtonLink href="/become-a-tutor">Start application</ButtonLink>
      </State>
    );
  }

  switch (app.status) {
    case "approved":
      return (
        <State icon={<img src="/icons/check-circle.svg" alt="" width={32} height={32} />} title="You’re approved — welcome!" description="Your profile is live and students can now book lessons with you. Add your availability to get your first booking.">
          <ButtonLink href="/tutor/schedule">Set availability</ButtonLink>
          {tutor ? (
            <ButtonLink href={`/tutors/${tutor.slug}`} variant="secondary">
              View public profile
            </ButtonLink>
          ) : null}
        </State>
      );
    case "declined":
      return (
        <State icon={<AlertCircle aria-hidden size={32} strokeWidth={1} className="text-danger" />} title="Application not approved" description={app.admin_notes || "We weren’t able to approve your application this time. You’re welcome to reapply with updated documents."}>
          <ButtonLink href="/contact" variant="secondary">
            Contact support
          </ButtonLink>
          <ButtonLink href="/become-a-tutor">Reapply</ButtonLink>
        </State>
      );
    case "more_info":
      return (
        <>
          <State
            className="min-h-[360px]"
            icon={<FilePlus aria-hidden size={32} strokeWidth={1} className="text-muted" />}
            title="We need a little more information"
            description={app.admin_notes || "Our reviewers need more details before they can verify your profile."}
          />
          <Card className="mx-auto w-full max-w-[640px]">
            <ResubmitForm applicationId={app.id} />
          </Card>
        </>
      );
    default:
      return (
        <State icon={<Clock aria-hidden size={32} strokeWidth={1} className="text-muted" />} title="Application under review" description="Thanks for applying. Verification usually takes 3–5 business days — we’ll email you when there’s an update.">
          <ButtonLink href="/contact" variant="secondary">
            Questions? Contact us
          </ButtonLink>
        </State>
      );
  }
}

function State({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-h-[560px] flex-col items-center justify-center gap-4 text-center", className)}>
      <img src="/icons/status-circle.svg" alt="" width={72} height={72} />
      {icon}
      <h1 className="text-[28px] text-black">{title}</h1>
      <p className="max-w-[520px] text-[12px] leading-[1.5] text-muted">{description}</p>
      {children ? <div className="flex flex-wrap justify-center gap-[10px]">{children}</div> : null}
    </div>
  );
}
