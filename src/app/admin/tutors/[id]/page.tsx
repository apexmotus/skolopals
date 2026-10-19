import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button, ButtonLink, Card, CardTitle, DetailRow, Field, Input, PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { TUTOR_STATUS_LABEL, hourlyRate, shortDate } from "@/lib/format";
import { setTutorStatus } from "../../actions";

export const metadata: Metadata = { title: "Tutor account" };

export default async function TutorAccountPage({ params }: PageProps<"/admin/tutors/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: tutor } = await supabase.from("tutors").select("*").eq("id", id).maybeSingle();
  if (!tutor) notFound();
  const { count: upcoming } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("tutor_id", id)
    .eq("status", "confirmed")
    .gte("starts_at", new Date().toISOString());
  const suspended = tutor.status === "suspended";

  return (
    <>
      <PageHeading title={tutor.full_name} description="Manage this tutor’s marketplace account." />
      {suspended ? (
        <div className="flex gap-3 rounded-[8px] bg-danger-soft p-[14px]">
          <span className="mt-1 size-[10px] shrink-0 rounded-full bg-danger" />
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-danger">Account suspended</p>
            <p className="text-[13px] text-danger">This tutor is hidden from search and can’t take new bookings until reactivated.</p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1">
          <CardTitle>Account details</CardTitle>
          <div className="flex flex-col gap-[10px]">
            <DetailRow label="Status" value={TUTOR_STATUS_LABEL[tutor.status]} />
            <DetailRow label="Subjects" value={tutor.subjects.join(", ")} />
            <DetailRow label="Rate" value={hourlyRate(tutor.hourly_rate_cents)} />
            <DetailRow label="Rating" value={`★ ${Number(tutor.rating).toFixed(1)} · ${tutor.review_count} reviews`} />
            <DetailRow label="Joined" value={shortDate(tutor.created_at)} />
          </div>
          <form action={setTutorStatus} className="flex flex-col gap-[14px]">
            <input type="hidden" name="tutor_id" value={tutor.id} />
            <input type="hidden" name="status" value={suspended ? "approved" : "suspended"} />
            <Field label={suspended ? "Note to tutor (optional)" : "Reason for suspension"} htmlFor="reason">
              <Input id="reason" name="reason" maxLength={500} required={!suspended} placeholder={suspended ? "Welcome back" : "e.g. Repeated late cancellations"} />
            </Field>
            <div className="flex flex-col gap-[10px] sm:flex-row">
              <Button variant={suspended ? "primary" : "danger"} className="w-fit">
                {suspended ? "Reactivate account" : "Suspend account"}
              </Button>
              <ButtonLink href={`/tutors/${tutor.slug}`} variant="secondary" className="w-fit">
                View public profile
              </ButtonLink>
            </div>
          </form>
        </Card>
        <Card className="w-full shrink-0 lg:w-[360px]">
          <CardTitle>Impact</CardTitle>
          <div className="flex flex-col gap-[10px]">
            <DetailRow label="Upcoming lessons" value={upcoming ?? 0} />
            <DetailRow label="Visible in search" value={suspended ? "No" : "Yes"} />
          </div>
          <div className="flex gap-3 rounded-[8px] bg-canvas p-[14px]">
            <span className="mt-1 size-[10px] shrink-0 rounded-full bg-brand" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-ink">Existing bookings</p>
              <p className="text-[12px] text-muted">
                Suspending doesn’t cancel booked lessons. Contact affected students if lessons need to be moved.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
