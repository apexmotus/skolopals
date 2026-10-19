import type { Metadata } from "next";
import { ButtonLink, Card, CardTitle, PageHeading } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApplicationForm } from "./application-form";

export const metadata: Metadata = { title: "Become a tutor" };

export default async function BecomeTutorPage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <div className="flex flex-col gap-5 p-4 md:p-7">
        <PageHeading title="Become a Skolopals tutor" description="Step 1 of 4 · Create your tutor account" />
        <Card className="max-w-[640px]">
          <CardTitle>Start with a tutor account</CardTitle>
          <p className="text-[13px] text-muted">
            Your account lets you save your application, upload documents securely and follow the review.
          </p>
          <div className="flex gap-[10px]">
            <ButtonLink href="/signup?role=tutor">Create tutor account</ButtonLink>
            <ButtonLink href="/login?next=/become-a-tutor" variant="secondary">
              I already have an account
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("tutor_applications")
    .select("id, status")
    .eq("user_id", profile.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.status !== "declined") {
    return (
      <div className="flex flex-col gap-5 p-4 md:p-7">
        <PageHeading title="Become a Skolopals tutor" description="You’ve already applied." />
        <Card className="max-w-[640px]">
          <CardTitle>Your application is on file</CardTitle>
          <p className="text-[13px] text-muted">Follow its progress or respond to reviewer requests from your workspace.</p>
          <ButtonLink href="/tutor/application" className="w-fit">
            View application status
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <ApplicationForm defaultName={profile.full_name} />
    </div>
  );
}
