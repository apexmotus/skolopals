import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button, Card, CardTitle, Field, Input, PageHeading, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { shortDate } from "@/lib/format";
import { decideApplication } from "../../../actions";

export const metadata: Metadata = { title: "Request more information" };

const OPTIONS = [
  "A clearer copy of your identity document",
  "Certificates for every subject you teach",
  "A reference from a school or previous employer",
];

export default async function RequestInfoPage({ params }: PageProps<"/admin/applications/[id]/request-info">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: app } = await supabase.from("tutor_applications").select("*").eq("id", id).maybeSingle();
  if (!app) notFound();

  return (
    <>
      <PageHeading title="Request more information" description={`Ask ${app.full_name} for what you need to finish the review.`} />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1">
          <form action={decideApplication} className="flex flex-col gap-[14px]">
            <input type="hidden" name="application_id" value={app.id} />
            <input type="hidden" name="decision" value="more_info" />
            <CardTitle>What’s missing?</CardTitle>
            {OPTIONS.map((o) => (
              <label key={o} className="flex items-center gap-[10px] text-[13px] text-ink">
                <input type="checkbox" name="requested" value={o} className="size-[18px] rounded accent-[#356a66]" />
                {o}
              </label>
            ))}
            <Field label="Message to applicant" htmlFor="note">
              <Textarea id="note" name="note" rows={3} maxLength={2000} placeholder="Explain what you need and why…" />
            </Field>
            <Field label="Reply needed within" htmlFor="deadline">
              <Input id="deadline" value="7 days" readOnly />
            </Field>
            <Button type="submit" className="w-fit">
              Send request
            </Button>
          </form>
        </Card>
        <Card className="w-full shrink-0 lg:w-[330px]">
          <CardTitle>Application summary</CardTitle>
          <p className="text-[13px] font-semibold text-ink">{app.full_name}</p>
          <p className="text-[12px] text-muted">
            {app.subjects} · {app.grades || "Grades not given"}
          </p>
          <p className="text-[11px] text-muted">Submitted {shortDate(app.submitted_at)}</p>
          <div className="flex gap-3 rounded-[8px] bg-warning-soft p-[14px]">
            <span className="mt-1 size-[10px] shrink-0 rounded-full bg-warning" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-ink">Review paused</p>
              <p className="text-[12px] text-muted">The application returns to your queue as soon as the tutor resubmits.</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
